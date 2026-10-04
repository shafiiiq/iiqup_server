const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');
const mongoose = require('mongoose');
const { PDFDocument } = require('pdf-lib');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { objectExists, getObjectUrl } = require('#core/s3/s3.config');
const { buildS3Key } = require('#core/upload/upload.helper');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service');
const documentModel = require('./document.model');
const {
  DOCUMENT_UPLOAD_FEATURE,
  buildDocumentKeyPrefix,
  buildPreviewKey,
  downloadPdfBufferFromS3,
  uploadBytesToS3,
  findSourceEntity,
  serializeDocument,
} = require('./document.helper');

const execFileAsync = promisify(execFile);

const CONVERSION_TIMEOUT_MILLISECONDS = 15 * 60 * 1000;
const LIBREOFFICE_BINARY = process.env.LIBREOFFICE_PATH || 'soffice';
const WORD_EXTENSIONS = ['doc', 'docx', 'odt', 'rtf'];
const PREVIEW_EXTENSIONS = ['doc', 'odt', 'rtf', 'ppt', 'pptx', 'odp', 'docx'];

const getExtension = (fileName) => path.extname(fileName).slice(1).toLowerCase();

const runLibreOffice = async ({ inputBuffer, inputExtension, outputTarget, importFilter }) => {
  const workDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'convert-'));
  try {
    const inputPath = path.join(workDirectory, `input.${inputExtension}`);
    await fs.writeFile(inputPath, inputBuffer);
    const outputExtension = outputTarget.split(':')[0];
    const args = ['--headless', '--norestore', `-env:UserInstallation=file://${path.join(workDirectory, 'profile')}`];
    if (importFilter) args.push(`--infilter=${importFilter}`);
    args.push('--convert-to', outputTarget, '--outdir', workDirectory, inputPath);
    await execFileAsync(LIBREOFFICE_BINARY, args, { timeout: CONVERSION_TIMEOUT_MILLISECONDS });
    return await fs.readFile(path.join(workDirectory, `input.${outputExtension}`));
  } catch (error) {
    logger.error('[document.convert.service] runLibreOffice', error);
    if (error.code === 'ENOENT') {
      throw new AppError('LibreOffice is not installed on the server', HTTP.NOT_IMPLEMENTED || 501);
    }
    throw new AppError('Conversion failed', HTTP.INTERNAL_SERVER_ERROR);
  } finally {
    await fs.rm(workDirectory, { recursive: true, force: true });
  }
};

const loadDocuments = async ({ sourceType, sourceId, documentIds }) => {
  const uniqueIds = [...new Set(documentIds.map(String))];
  if (!uniqueIds.every((documentId) => mongoose.isValidObjectId(documentId))) {
    throw new AppError('Invalid document ID', HTTP.BAD_REQUEST);
  }
  const documents = await documentModel.find({ _id: { $in: uniqueIds }, sourceType, sourceId, deletedAt: null });
  if (documents.length !== uniqueIds.length) throw new AppError('One or more documents not found', HTTP.NOT_FOUND);
  const documentById = new Map(documents.map((documentItem) => [documentItem._id.toString(), documentItem]));
  return uniqueIds.map((documentId) => documentById.get(documentId));
};

const saveConverted = async ({ templateDocument, bytes, extension, mimeType, displayName, uploadedBy }) => {
  const s3Key = buildS3Key(
    DOCUMENT_UPLOAD_FEATURE,
    buildDocumentKeyPrefix(templateDocument.sourceType, templateDocument.sourceId),
    `${displayName}.${extension}`
  );
  await uploadBytesToS3(bytes, s3Key, mimeType);
  return documentModel.create({
    folderId: templateDocument.folderId,
    area: templateDocument.area || 'all',
    sourceType: templateDocument.sourceType,
    sourceId: templateDocument.sourceId,
    displayName,
    originalFileName: `${displayName}.${extension}`,
    s3Key,
    mimeType,
    fileSize: bytes.length,
    issueDate: templateDocument.issueDate,
    expiryDate: templateDocument.expiryDate,
    uploadedBy,
  });
};

const convertWordToPdf = async (documents, uploadedBy) => {
  const created = [];
  for (const documentItem of documents) {
    if (!WORD_EXTENSIONS.includes(getExtension(documentItem.originalFileName))) {
      throw new AppError(`${documentItem.displayName} is not a Word document`, HTTP.BAD_REQUEST);
    }
    const bytes = await runLibreOffice({
      inputBuffer: await downloadPdfBufferFromS3(documentItem.s3Key),
      inputExtension: getExtension(documentItem.originalFileName),
      outputTarget: 'pdf',
    });
    created.push(
      await saveConverted({
        templateDocument: documentItem,
        bytes,
        extension: 'pdf',
        mimeType: 'application/pdf',
        displayName: documentItem.displayName,
        uploadedBy,
      })
    );
  }
  return created;
};

const convertPdfToWord = async (documents, uploadedBy) => {
  const created = [];
  for (const documentItem of documents) {
    if (getExtension(documentItem.originalFileName) !== 'pdf') {
      throw new AppError(`${documentItem.displayName} is not a PDF`, HTTP.BAD_REQUEST);
    }
    const bytes = await runLibreOffice({
      inputBuffer: await downloadPdfBufferFromS3(documentItem.s3Key),
      inputExtension: 'pdf',
      outputTarget: 'docx:MS Word 2007 XML',
      importFilter: 'writer_pdf_import',
    });
    created.push(
      await saveConverted({
        templateDocument: documentItem,
        bytes,
        extension: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        displayName: documentItem.displayName,
        uploadedBy,
      })
    );
  }
  return [...created];
};

const convertImagesToPdf = async (documents, uploadedBy) => {
  const pdf = await PDFDocument.create();
  for (const documentItem of documents) {
    const extension = getExtension(documentItem.originalFileName);
    const bytes = await downloadPdfBufferFromS3(documentItem.s3Key);
    let image;
    if (extension === 'jpg' || extension === 'jpeg') image = await pdf.embedJpg(bytes);
    else if (extension === 'png') image = await pdf.embedPng(bytes);
    else throw new AppError('Only JPG and PNG images can be converted', HTTP.BAD_REQUEST);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const displayName = documents.length === 1 ? documents[0].displayName : 'Combined Images';
  const created = await saveConverted({
    templateDocument: documents[0],
    bytes: await pdf.save(),
    extension: 'pdf',
    mimeType: 'application/pdf',
    displayName,
    uploadedBy,
  });
  return [created];
};

const CONVERSION_HANDLERS = {
  wordToPdf: convertWordToPdf,
  pdfToWord: convertPdfToWord,
  imagesToPdf: convertImagesToPdf,
};

const convertDocuments = async ({ sourceType, sourceId, conversion, documentIds, uploadedBy }) => {
  const handler = CONVERSION_HANDLERS[conversion];
  if (!handler) throw new AppError('Unsupported conversion', HTTP.BAD_REQUEST);
  if (!(await findSourceEntity(sourceType, sourceId))) throw new AppError(`${sourceType} not found`, HTTP.NOT_FOUND);
  const documents = await loadDocuments({ sourceType, sourceId, documentIds });
  const created = await handler(documents, uploadedBy);
  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('documents');
  const data = await Promise.all(created.map(serializeDocument));
  return { status: HTTP.CREATED, message: 'Converted', data };
};

const getPreviewPdfUrl = async ({ documentId }) => {
  if (!mongoose.isValidObjectId(documentId)) throw new AppError('Invalid document ID', HTTP.BAD_REQUEST);
  const documentItem = await documentModel.findOne({ _id: documentId, deletedAt: null });
  if (!documentItem) throw new AppError('Document not found', HTTP.NOT_FOUND);
  const extension = getExtension(documentItem.originalFileName);
  if (!PREVIEW_EXTENSIONS.includes(extension)) throw new AppError('This file type cannot be previewed', HTTP.BAD_REQUEST);

  const previewKey = buildPreviewKey(documentItem.s3Key);
  if (!(await objectExists(previewKey))) {
    const bytes = await runLibreOffice({
      inputBuffer: await downloadPdfBufferFromS3(documentItem.s3Key),
      inputExtension: extension,
      outputTarget: 'pdf',
    });
    await uploadBytesToS3(bytes, previewKey, 'application/pdf');
  }
  return { status: HTTP.OK, message: 'Preview ready', data: { url: await getObjectUrl(previewKey, false) } };
};

module.exports = { convertDocuments, getPreviewPdfUrl };