const { getObjectUrl, putObject } = require('../s3bucket/s3.bucket');

module.exports = {
    fetchPresignedURL: (s3key, isLong, isAuthSign = false) => {
        return new Promise(async (resolve, reject) => {
            try {
                const dataURL = await getObjectUrl(s3key, isLong, isAuthSign);
                resolve({
                    status: 200,
                    ok: true,
                    dataUrl: dataURL
                    // dataUrl: "https://wallpapercave.com/wp/wp4088642.jpg"
                });
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: error.message || 'Error fetching users'
                });
            }
        });
    },

    uploadToS3: async (fileBuffer, s3Key, mimeType) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Step 1: Get presigned URL for upload
                const uploadUrl = await putObject('upload', s3Key, mimeType);

                // Step 2: Upload the file to S3 using the presigned URL
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: fileBuffer,
                    headers: {
                        'Content-Type': mimeType
                    }
                });

                if (!uploadResponse.ok) {
                    throw new Error(`S3 upload failed with status: ${uploadResponse.status}`);
                }

                console.log('Successfully uploaded file to S3:', s3Key);

                resolve({
                    status: 200,
                    ok: true,
                    message: 'File uploaded successfully',
                    s3Key: s3Key,
                    uploadUrl: uploadUrl
                });
            } catch (error) {
                console.error('Error uploading file to S3:', error);
                reject({
                    status: 500,
                    ok: false,
                    message: error.message || 'Error uploading file to S3'
                });
            }
        });
    }
}