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
    const { page = 1, limit = 20, hired } = req.query;

    const result = await equipmentServices.fetchEquipments(
      parseInt(page),
      parseInt(limit),
      hired // Pass hired filter: 'hired', 'own', or null/undefined for all
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
    const { searchTerm, page = 1, limit = 20, searchField = 'all', hired } = req.body;

    console.log("logggggggggggg", req.body)

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
      searchField,
      hired
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

  console.log("updateData", updateData.certificationBody);

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
  const { id } = req.params;
  const updateData = req.body;

  equipmentServices.changeStatus(id, updateData)
    .then((updatedUser) => {
      if (updatedUser) {
        res.status(updatedUser.status).json(updatedUser)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}

const changeEquipmentStatus = async (req, res) => {
  try {
    const {
      equipmentId,
      regNo,
      machine,
      previousStatus,
      newStatus,
      month,
      year,
      time,
      remarks
    } = req.body;

    // Validation
    if (!equipmentId || !regNo || !machine || !previousStatus || !newStatus || !month || !year || !time) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Missing required fields: equipmentId, regNo, machine, previousStatus, newStatus, month, year, time'
      });
    }

    if (previousStatus === newStatus) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Previous status and new status cannot be the same'
      });
    }

    const result = await equipmentServices.changeEquipmentStatus({
      equipmentId,
      regNo,
      machine,
      previousStatus,
      newStatus,
      month,
      year,
      time,
      remarks: remarks || ''
    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error changing equipment status:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


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
    const { searchTerm, searchField = 'all', hired } = req.query;

    let query = {};
    if (hired === 'hired') {
      query.hired = true;
    } else if (hired === 'own') {
      query.hired = false;
    }

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

const getEquipmentStats = async (req, res) => {
  try {
    const { hired } = req.query;
    const result = await equipmentServices.fetchEquipmentStats(hired);

    res.status(200).json({
      status: 200,
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting equipment stats:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getEquipmentsByStatus = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, hired } = req.query;

    const result = await equipmentServices.fetchEquipmentsByStatus(
      status,
      parseInt(page),
      parseInt(limit),
      hired
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
    console.error('Error getting equipments by status:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const mobilizeEquipment = async (req, res) => {
  try {
    const {
      equipmentId,
      regNo,
      machine,
      site,
      operator,
      withOperator,
      month,
      year,
      time,
      remarks
    } = req.body;

    // Validation
    if (!equipmentId || !regNo || !machine || !site || !month || !year || !time) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Missing required fields: equipmentId, regNo, machine, site, month, year, time'
      });
    }

    if (withOperator && !operator) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Operator is required when withOperator is true'
      });
    }

    const result = await equipmentServices.mobilizeEquipment({
      equipmentId,
      regNo,
      machine,
      site,
      operator,
      withOperator: withOperator || false,
      month,
      year,
      time,
      remarks: remarks || ''
    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error mobilizing equipment:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const demobilizeEquipment = async (req, res) => {
  try {
    const {
      equipmentId,
      regNo,
      machine,
      month,
      year,
      time,
      remarks
    } = req.body;

    // Validation
    if (!equipmentId || !regNo || !machine || !month || !year || !time) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Missing required fields: equipmentId, regNo, machine, month, year, time'
      });
    }

    const result = await equipmentServices.demobilizeEquipment({
      equipmentId,
      regNo,
      machine,
      month,
      year,
      time,
      remarks: remarks || ''
    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error demobilizing equipment:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getMobilizationHistory = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!equipmentId) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Equipment ID is required'
      });
    }

    const result = await equipmentServices.getMobilizationHistory(
      parseInt(equipmentId),
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      status: 200,
      ok: true,
      data: result.history,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasMore: result.hasNextPage
      }
    });
  } catch (error) {
    console.error('Error getting mobilization history:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const replaceOperator = async (req, res) => {
  try {
    const {
      equipmentId,
      regNo,
      machine,
      currentOperator,
      currentOperatorId,
      replacedOperator,
      replacedOperatorId,
      month,
      year,
      time,
      remarks
    } = req.body;

    console.log("data", req.body)
    // Validation
    if (!equipmentId || !regNo || !machine || !currentOperator || !currentOperatorId || !replacedOperator || !replacedOperatorId || !month || !year || !time) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Missing required fields: equipmentId, regNo, machine, currentOperator, currentOperatorId, replacedOperator, replacedOperatorId, month, year, time'
      });
    }

    const result = await equipmentServices.replaceOperator({
      equipmentId,
      regNo,
      machine,
      currentOperator,
      currentOperatorId,
      replacedOperator,
      replacedOperatorId,
      month,
      year,
      time,
      remarks: remarks || ''
    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error replacing operator:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const replaceEquipment = async (req, res) => {
  try {
    const {
      equipmentId,
      regNo,
      machine,
      replacedEquipmentId,
      replacedEquipmentRegNo,
      replacedEquipmentMachine,
      newSiteForReplaced, // Optional: new site for the replaced equipment (equipmentId)
      month,
      year,
      time,
      remarks
    } = req.body;

    console.log("data", req.body)

    // Validation
    if (!equipmentId || !regNo || !machine || !replacedEquipmentId || !replacedEquipmentRegNo || !replacedEquipmentMachine || !month || !year || !time) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Missing required fields: equipmentId, regNo, machine, replacedEquipmentId, replacedEquipmentRegNo, replacedEquipmentMachine, month, year, time'
      });
    }

    const result = await equipmentServices.replaceEquipment({
      equipmentId,
      regNo,
      machine,
      replacedEquipmentId,
      replacedEquipmentRegNo,
      replacedEquipmentMachine,
      newSiteForReplaced: newSiteForReplaced || null,
      month,
      year,
      time,
      remarks: remarks || ''
    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error replacing equipment:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getReplacementHistory = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    if (!equipmentId) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Equipment ID is required'
      });
    }

    const result = await equipmentServices.getReplacementHistory(
      parseInt(equipmentId),
      parseInt(page),
      parseInt(limit),
      type // Optional filter: 'operator', 'site', 'equipment'
    );

    res.status(200).json({
      status: 200,
      ok: true,
      data: result.history,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasMore: result.hasNextPage
      }
    });
  } catch (error) {
    console.error('Error getting replacement history:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getSites = async (req, res) => {
  try {
    const result = await equipmentServices.fetchUniqueSites();
    res.status(200).json({
      status: 200,
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting sites:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getAllMobilizations = async (req, res) => {
  try {
    const result = await equipmentServices.fetchAllMobilizations();

    res.status(200).json({
      status: 200,
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting all mobilizations:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getAllReplacements = async (req, res) => {
  try {
    const result = await equipmentServices.fetchAllReplacements();

    res.status(200).json({
      status: 200,
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting all replacements:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getFilteredMobilizations = async (req, res) => {
  try {
    const {
      filterType,
      startDate,
      endDate,
      months,
      specificTime,
      startTime,
      endTime
    } = req.query;

    if (!filterType) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Filter type is required (daily, yesterday, weekly, monthly, yearly, months, custom, single)'
      });
    }

    if (filterType === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Start date and end date are required for custom range'
      });
    }

    if (filterType === 'single' && !startDate) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Date is required for single date filter'
      });
    }

    if (filterType === 'months' && !months) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Months parameter is required for months filter type'
      });
    }

    if (startTime && endTime && startTime > endTime) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Start time must be before end time'
      });
    }

    const result = await equipmentServices.fetchFilteredMobilizations(
      filterType,
      startDate,
      endDate,
      months,
      specificTime,
      startTime,
      endTime
    );

    res.status(200).json({
      status: 200,
      ok: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error('Error getting filtered mobilizations:', error);
    res.status(500).json({
      status: 500,
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getFilteredReplacements = async (req, res) => {
  try {
    const { filterType, startDate, endDate, months } = req.query;

    if (!filterType) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Filter type is required (daily, yesterday, weekly, monthly, yearly, months, custom)'
      });
    }

    if (filterType === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Start date and end date are required for custom range'
      });
    }

    if (filterType === 'months' && !months) {
      return res.status(400).json({
        status: 400,
        ok: false,
        message: 'Months parameter is required for months filter type'
      });
    }

    const result = await equipmentServices.fetchFilteredReplacements(
      filterType,
      startDate,
      endDate,
      months
    );

    res.status(200).json({
      status: 200,
      ok: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error('Error getting filtered replacements:', error);
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
  getEquipmentCount,
  getEquipmentStats,
  getEquipmentsByStatus,
  mobilizeEquipment,
  demobilizeEquipment,
  getMobilizationHistory,
  replaceOperator,
  replaceEquipment,
  getReplacementHistory,
  getSites,
  getAllReplacements,
  getAllMobilizations,
  getFilteredMobilizations,
  getFilteredReplacements,
  changeEquipmentStatus
};
