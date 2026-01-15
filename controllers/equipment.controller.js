const equipmentServices = require('../services/equipment-services')

const addEquipments = async (req, res) => {
  equipmentServices.insertEquipments(req.body)
    .then((addedUser) => {
      if (addedUser) {
        res.status(addedUser.status).json(addedUser)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

const getEquipments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await equipmentServices.fetchEquipments(
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      status: 200,
      ok: true,
      data: result.equipments,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasMore: result.hasNextPage
      }
    });
  } catch (error) {
    console.error('Error getting equipments:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const searchEquipments = async (req, res) => {
  try {
    const { searchTerm, page = 1, limit = 20, searchField = 'all' } = req.body;

    if (!searchTerm || searchTerm.trim() === '') {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Search term is required'
      });
    }

    const result = await equipmentServices.searchEquipments(
      searchTerm.trim(),
      parseInt(page),
      parseInt(limit),
      searchField
    );

    res.status(200).json({
      status: 200,
      ok: true,
      data: result.equipments,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasMore: result.hasNextPage
      },
      searchTerm: searchTerm
    });
  } catch (error) {
    console.error('Error searching equipments:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getEquipmentsByReg = async (req, res) => {
  const { regNo } = req.params
  equipmentServices.fetchEquipmentByReg(regNo)
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        res.status(fetchedUsers.status).json(fetchedUsers)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all users', error: err.message })
    })
}

const updateEquipments = async (req, res) => {
  const { regNo } = req.params;
  const updateData = req.body;

  console.log("updateData", updateData);

  equipmentServices.updateEquipments(regNo, updateData)
    .then((updatedUser) => {
      if (updatedUser) {
        res.status(updatedUser.status).json(updatedUser)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}


const deleteEquipments = async (req, res) => {
  const { regNo } = req.params;

  equipmentServices.deleteEquipments(regNo)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}


const updateStatus = async (req, res) => {
  const { regNo } = req.params;
  const updateData = req.body;

  equipmentServices.changeStatus(regNo, updateData)
    .then((updatedUser) => {
      if (updatedUser) {
        res.status(updatedUser.status).json(updatedUser)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}


const addEquipmentImage = async (req, res) => {
  try {
    const { equipmentNo, files } = req.body;

    if (!equipmentNo) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Equipment ID is required'
      });
    }

    if (!files || !files.length) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'At least one file is required'
      });
    }

    // Generate presigned URLs for each file
    const filesWithUploadData = await Promise.all(
      files.map(async (file, index) => {
        const imageLabel = file.label || 'Unlabeled';

        const ext = path.extname(file.fileName);
        const finalFilename = `${equipmentNo}-${Date.now()}-${index}${ext}`;
        const s3Key = `equipment-images/${equipmentNo}/${finalFilename}`;

        const uploadUrl = await putObject(
          file.fileName,
          s3Key,
          file.mimeType
        );

        const saveResult = await equipmentServices.addEquipmentImage(
          equipmentNo,
          s3Key,
          imageLabel,
          finalFilename,
          file.mimeType
        );

        if (!saveResult.success) {
          throw new Error(`Failed to save image metadata: ${saveResult.message}`);
        }

        return {
          fileName: finalFilename,
          originalName: file.fileName,
          filePath: s3Key,
          mimeType: file.mimeType,
          type: file.mimeType.startsWith('video/') ? 'video' : 'photo',
          uploadUrl: uploadUrl,
          uploadDate: new Date(),
          label: imageLabel,
          dbSaveResult: saveResult
        };
      })
    );

    res.status(200).json({
      status: 200,
      message: 'Pre-signed URLs generated and metadata saved',
      data: {
        uploadData: filesWithUploadData
      }
    });

  } catch (err) {
    res.status(err.status || 500).json({
      status: err.status || 500,
      success: false,
      message: err.message || 'Internal server error'
    });
  }
};

const getEquipmentRegNo = async (req, res) => {
  try {
    const regNo = req.params.regNo;

    if (!regNo) {
      return res.status(400).json({
        success: false,
        message: 'Equipment regNo is required'
      });
    }

    const result = await equipmentServices.getEquipmentRegNo(regNo);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

const getBulkEquipmentImages = async (req, res) => {
  try {
    const { regNos } = req.body;
    
    if (!regNos || !Array.isArray(regNos) || regNos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of equipment regNos is required'
      });
    }
    
    // Limit to prevent overload (20 matches your pagination limit)
    if (regNos.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 50 equipment regNos allowed per request'
      });
    }
    
    const result = await equipmentServices.getBulkEquipmentImages(regNos);
    console.log("HIiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiIIIIIIIII")
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

const getEquipmentCount = async (req, res) => {
  try {
    const { searchTerm, searchField = 'all' } = req.query;

    let query = { outside: false };

    if (searchTerm && searchTerm.trim() !== '') {
      if (searchField === 'all') {
        query.$or = [
          { machine: { $regex: searchTerm, $options: 'i' } },
          { regNo: { $regex: searchTerm, $options: 'i' } },
          { brand: { $regex: searchTerm, $options: 'i' } },
          { company: { $regex: searchTerm, $options: 'i' } },
          { status: { $regex: searchTerm, $options: 'i' } },
          { site: { $regex: searchTerm, $options: 'i' } },
          { certificationBody: { $regex: searchTerm, $options: 'i' } }
        ];

        if (!isNaN(searchTerm)) {
          query.$or.push({ year: parseInt(searchTerm) });
        }
      } else if (searchField === 'site') {
        query.site = { $regex: searchTerm, $options: 'i' };
      } else {
        query[searchField] = { $regex: searchTerm, $options: 'i' };
      }
    }

    const count = await equipmentModel.countDocuments(query);

    res.status(200).json({
      status: 200,
      ok: true,
      count
    });
  } catch (error) {
    console.error('Error getting equipment count:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  addEquipments,
  getEquipments,
  updateEquipments,
  deleteEquipments,
  updateStatus,
  getEquipmentsByReg,
  searchEquipments,
  addEquipmentImage,
  getEquipmentRegNo,
  getBulkEquipmentImages,
  getEquipmentCount
};
