const { promises } = require('fs');
const equipmentModel = require('../models/equip.model');
const mobilizationModel = require('../models/mobilizations.model');
const replacementsModel = require('../models/replacements.model');
const OperatorModel = require('../models/operator.model');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');
const EquipmentImageModel = require('../models/equip-hand-over-stock.model');
const OperatorService = require('./operator-services')

const getCurrentDateTime = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return { month, year, time };
};

module.exports = {

  insertEquipments: (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        const existingUser = await equipmentModel.findOne({ regNo: data.regNo });

        if (existingUser) {
          return reject({
            status: 500,
            ok: false,
            message: 'Equipment already exists',
          });
        }

        const equipments = await equipmentModel.find({});
        data.id = equipments.length + 1;

        console.log('Next ID:', data.id);

        const equipment = await equipmentModel.create(data);

        // Send notification for new equipment
        try {
          const notification = await createNotification({
            title: "New Asset Launched",
            description: `Alhamdulillah , We are happy to inform to you! We have bought a brand new ${equipment.machine} (${equipment.brand}) today`,
            priority: "high",
            sourceId: equipment._id,
            time: new Date(),
            recipient: JSON.parse(process.env.OFFICE_MAIN)
          });

          await PushNotificationService.sendGeneralNotification(
            JSON.parse(process.env.OFFICE_MAIN),
            "New Asset Launched", //title
            `Alhamdulillah , We are happy to inform to you! We have bought a brand new ${equipment.machine} (${equipment.brand}) today`, //description
            'high', //priority
            'normal', // type
            notification.data._id.toString()
          );
        } catch (notificationError) {
          console.error('Failed to send notification for new equipment:', notificationError);
          // Don't reject the main operation if notification fails
        }

        resolve({
          status: 200,
          ok: true,
          message: 'Equipment added successfully',
          data: equipment
        });

      } catch (err) {
        console.log(err);

        // Handle duplicate key error specifically
        if (err.code === 11000) {
          // Find next available ID by incrementing until we find one that works
          let attempts = 0;
          const maxAttempts = 10;

          while (attempts < maxAttempts) {
            try {
              data.id = data.id + 1;
              console.log('Retrying with ID:', data.id);

              const equipment = await equipmentModel.create(data);

              // Send notification for new equipment (retry case)
              try {
                const notification = await createNotification({
                  title: "New Asset Launched",
                  description: `Alhamdulillah , We are happy to inform to you! We have bought a brand new ${equipment.machine} (${equipment.brand}) today`,
                  priority: "high",
                  sourceId: equipment._id,
                  time: new Date()
                });

                await PushNotificationService.sendGeneralNotification(
                  null, // broadcast to all users
                  "New Asset Launched", //title
                  `Alhamdulillah , We are happy to inform to you! We have bought a brand new ${equipment.machine} (${equipment.brand}) today`, //description
                  'high', //priority
                  'normal', // type
                  notification.data._id.toString()
                );
              } catch (notificationError) {
                console.error('Failed to send notification for new equipment:', notificationError);
              }

              return resolve({
                status: 200,
                ok: true,
                message: 'Equipment added successfully',
                data: equipment
              });
            } catch (retryErr) {
              if (retryErr.code === 11000) {
                attempts++;
                continue; // Try next ID
              } else {
                // Different error, reject
                return reject({
                  status: 500,
                  ok: false,
                  message: 'Failed to create equipment',
                  error: retryErr.message
                });
              }
            }
          }

          // If we've exhausted all attempts
          reject({
            status: 500,
            ok: false,
            message: 'Unable to find available ID after multiple attempts',
            error: 'Too many duplicate IDs'
          });
        } else {
          reject({
            status: 500,
            ok: false,
            message: 'Missing data or an error occurred',
            error: err.message
          });
        }
      }
    });
  },

  sortData: (data, key, direction) => {
    return [...data].sort((a, b) => {
      let aValue = a[key];
      let bValue = b[key];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // Handle year sorting - convert to numbers
      if (key === 'year') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      }

      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Simplified comparison
      if (aValue === bValue) return 0;

      if (direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  },

  fetchEquipments: function (page = 1, limit = 20, hiredFilter = null) {
    return new Promise(async (resolve, reject) => {
      try {
        const skip = (page - 1) * limit;

        // Build query based on hiredFilter
        let query = {};
        if (hiredFilter === 'hired') {
          query.hired = true;
        } else if (hiredFilter === 'own') {
          query.hired = false;
        }

        // Get total count
        const totalCount = await equipmentModel.countDocuments(query);

        // Fetch paginated data
        const equipments = await equipmentModel.find(query)
          .sort({ year: -1, createdAt: -1 }) // Sort by year desc, then by creation date
          .skip(skip)
          .limit(limit)
          .lean(); // Use lean() for better performance

        const totalPages = Math.ceil(totalCount / limit);

        resolve({
          status: 200,
          ok: true,
          equipments,
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages
        });
      } catch (error) {
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching equipments'
        });
      }
    });
  },

  searchEquipments: function (searchTerm, page = 1, limit = 20, searchField = 'all', hiredFilter = null) {
    return new Promise(async (resolve, reject) => {
      try {
        const skip = (page - 1) * limit;

        // Build base query based on hiredFilter
        let baseQuery = {};
        if (hiredFilter === 'hired') {
          baseQuery.hired = true;
        } else if (hiredFilter === 'own') {
          baseQuery.hired = false;
        }

        // Build search query based on searchField
        let searchQuery = {};

        if (searchField === 'all') {
          // Search across multiple fields
          searchQuery.$or = [
            { machine: { $regex: searchTerm, $options: 'i' } },
            { regNo: { $regex: searchTerm, $options: 'i' } },
            { brand: { $regex: searchTerm, $options: 'i' } },
            { company: { $regex: searchTerm, $options: 'i' } },
            { status: { $regex: searchTerm, $options: 'i' } },
            { site: { $regex: searchTerm, $options: 'i' } },
            { coc: { $regex: searchTerm, $options: 'i' } },
            // Fix for certificationBody (array of objects)
            { 'certificationBody.operatorName': { $regex: searchTerm, $options: 'i' } },
            { 'certificationBody.operatorId': { $regex: searchTerm, $options: 'i' } }
          ];

          // Check if searchTerm is a number for year search
          if (!isNaN(searchTerm)) {
            searchQuery.$or.push({ year: parseInt(searchTerm) });
          }
        } else if (searchField === 'site') {
          // Site-specific search
          searchQuery.site = { $regex: searchTerm, $options: 'i' };
        } else {
          // Specific field search
          searchQuery[searchField] = { $regex: searchTerm, $options: 'i' };
        }

        // Combine baseQuery and searchQuery
        const query = { ...baseQuery, ...searchQuery };

        // Get total count for search results
        const totalCount = await equipmentModel.countDocuments(query);

        // Fetch paginated search results
        const equipments = await equipmentModel.find(query)
          .sort({ year: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        const totalPages = Math.ceil(totalCount / limit);

        resolve({
          status: 200,
          ok: true,
          equipments,
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages
        });
      } catch (error) {
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error searching equipments'
        });
      }
    });
  },

  fetchEquipmentByReg: (regNo) => {
    return new Promise(async (resolve, reject) => {
      try {
        const data = await equipmentModel.find({ regNo: regNo });
        resolve({
          status: 200,
          ok: true,
          data: data
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

  changeEquipmentStatus: async function (data) {
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
      } = data;

      // Create mobilization record for status change
      const statusChange = new mobilizationModel({
        equipmentId,
        regNo,
        machine,
        action: 'status_changed',
        previousStatus,
        newStatus,
        withOperator: false,
        month,
        year,
        date: new Date(),
        time,
        remarks: remarks || '',
        status: newStatus
      });

      await statusChange.save();

      // Update equipment status
      const updatedEquipment = await equipmentModel.findOneAndUpdate(
        { _id: equipmentId },
        {
          $set: {
            status: newStatus,
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (!updatedEquipment) {
        return {
          status: 404,
          ok: false,
          message: 'Equipment not found'
        };
      }

      return {
        status: 200,
        ok: true,
        message: 'Equipment status changed successfully',
        data: {
          statusChange,
          updatedEquipment
        }
      };
    } catch (error) {
      console.error('Error in changeEquipmentStatus service:', error);
      throw error;
    }
  },

  updateEquipments: (regNo, updatedData, equipmentNumber = null, operatorName = null) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (equipmentNumber && operatorName) {
          const equipment = await equipmentModel.findOne({ regNo: equipmentNumber });
          if (!equipment) {
            return reject({ status: 404, ok: false, message: 'Equipment not found' });
          }

          const result = await equipmentModel.findOneAndUpdate(
            { regNo: equipmentNumber },
            { operator: operatorName },
            { new: true, runValidators: true }
          );

          const notification = await createNotification({
            title: "Operator Updated",
            description: `${equipment.machine} - ${equipment.regNo}'s new operator is ${operatorName}`,
            priority: "medium",
            sourceId: equipment._id,
            time: new Date()
          });

          await PushNotificationService.sendGeneralNotification(
            null,
            'Operator Updated',
            `${equipment.machine} - ${equipment.regNo}'s new operator is ${operatorName}`,
            'medium',
            'normal',
            notification.data._id.toString()
          );

          return resolve({
            status: 200,
            ok: true,
            message: 'Equipment updated successfully',
            data: result
          });
        }

        const equipment = await equipmentModel.findOne({ regNo: regNo });
        if (!equipment) {
          return reject({ status: 404, ok: false, message: 'Equipment not found' });
        }

        // ✅ MIGRATION: Convert old string format to new object format
        if (equipment.certificationBody && equipment.certificationBody.length > 0) {
          const needsMigration = equipment.certificationBody.some(item => typeof item === 'string');

          if (needsMigration) {
            console.log(`Migrating certificationBody for equipment ${regNo}`);

            const migratedCertificationBody = equipment.certificationBody.map(item => {
              if (typeof item === 'string') {
                return {
                  operatorName: item,
                  operatorId: '',
                  assignedAt: new Date()
                };
              }
              return item;
            });

            await equipmentModel.findOneAndUpdate(
              { regNo: regNo },
              { $set: { certificationBody: migratedCertificationBody } },
              { new: true }
            );

            equipment.certificationBody = migratedCertificationBody;
          }
        }

        // Store original data for notification comparison
        const originalEquipment = { ...equipment.toObject() };

        // ✅ FIX: Remove certificationBody from updatedData to prevent overwriting
        const { _id, __v, createdAt, certificationBody, ...cleanUpdatedData } = updatedData;

        // Handle operator addition to certificationBody
        const updateData = { ...cleanUpdatedData };

        if (cleanUpdatedData.operator && cleanUpdatedData.operatorId) {
          updateData.$push = {
            certificationBody: {
              operatorName: cleanUpdatedData.operator,
              operatorId: cleanUpdatedData.operatorId,
              assignedAt: new Date()
            }
          };
          delete updateData.operator;
          delete updateData.operatorId;
        } else if (cleanUpdatedData.operator && !cleanUpdatedData.operatorId) {
          console.warn('Operator provided without operatorId - this is deprecated');
          updateData.$push = {
            certificationBody: {
              operatorName: cleanUpdatedData.operator,
              operatorId: '',
              assignedAt: new Date()
            }
          };
          delete updateData.operator;
        }

        const result = await equipmentModel.findOneAndUpdate(
          { regNo: regNo },
          updateData,
          { new: true, runValidators: true }
        );

        // ✅ SEND NOTIFICATION FOR STATUS CHANGE
        try {
          const changes = [];

          // Check for status change
          if (updatedData.status && originalEquipment.status !== updatedData.status) {
            changes.push(`status changed from ${originalEquipment.status} to ${updatedData.status}`);

            // Create mobilization record for status change
            const { month, year, time } = getCurrentDateTime();

            const statusChange = new mobilizationModel({
              equipmentId: equipment._id,
              regNo: equipment.regNo,
              machine: equipment.machine,
              action: 'status_changed',
              previousStatus: originalEquipment.status,
              newStatus: updatedData.status,
              withOperator: false,
              month,
              year,
              date: new Date(),
              time,
              remarks: `Status updated via edit modal`,
              status: updatedData.status
            });

            await statusChange.save();
          }

          if (updatedData.site && JSON.stringify(originalEquipment.site) !== JSON.stringify(updatedData.site)) {
            let siteText;
            if (Array.isArray(updatedData.site)) {
              siteText = updatedData.site.join(', ');
            } else {
              siteText = String(updatedData.site);
            }
            changes.push(`site is: ${siteText}`);
          }

          if (result.certificationBody &&
            JSON.stringify(originalEquipment.certificationBody) !== JSON.stringify(result.certificationBody)) {
            if (Array.isArray(result.certificationBody) && result.certificationBody.length > 0) {
              const lastOperator = result.certificationBody[result.certificationBody.length - 1];
              const operatorName = lastOperator?.operatorName || String(lastOperator);

              if (operatorName && typeof operatorName === 'string') {
                changes.push(`operator is: ${operatorName}`);
              }
            }
          }

          if (changes.length > 0) {
            const changesText = changes.join(', ');

            const notification = await createNotification({
              title: "Equipment Updated",
              description: `${equipment.machine} - ${equipment.regNo}'s new ${changesText}`,
              priority: "medium",
              sourceId: equipment._id,
              time: new Date()
            });

            await PushNotificationService.sendGeneralNotification(
              null,
              'Equipment Updated',
              `${equipment.machine} - ${equipment.regNo}'s new ${changesText}`,
              'medium',
              'normal',
              notification.data._id.toString()
            );
          }

        } catch (notificationError) {
          console.error('Failed to send notification for equipment update:', notificationError);
        }

        resolve({
          status: 200,
          ok: true,
          message: 'Equipment updated successfully',
          data: result
        });
      } catch (error) {
        console.error('Error in updateEquipments:', error);
        reject({ status: 500, ok: false, message: 'Unable to update equipment' });
      }
    });
  },

  deleteEquipments: (regNo) => {
    return new Promise(async (resolve, reject) => {
      try {
        const equipment = await equipmentModel.findOne({ regNo });
        console.log(equipment);

        if (equipment) {
          const deleteEquipment = await equipmentModel.findOneAndDelete({ regNo: equipment.regNo });

          // Send notification for equipment deletion
          try {
            const notification = await createNotification({
              title: "Equipment Removed",
              description: `Equipment ${deleteEquipment.machine} - ${deleteEquipment.regNo} has been removed from the system or sold`,
              priority: "medium",
              sourceId: deleteEquipment._id,
              time: new Date()
            });

            await PushNotificationService.sendGeneralNotification(
              null, // broadcast to all users
              'Equipment Removed', //title
              `Equipment ${deleteEquipment.machine} - ${deleteEquipment.regNo} has been removed from the system or sold`, //decription
              'medium', //priority
              'normal', // type
              notification.data._id.toString()
            );
          } catch (notificationError) {
            console.error('Failed to send notification for equipment deletion:', notificationError);
            // Don't reject the main operation if notification fails
          }

          return resolve({
            status: 200,
            ok: true,
            message: 'Equipment deleted successfully',
            data: deleteEquipment
          });
        }
      } catch (error) {
        reject({
          status: 500,
          ok: false,
          message: 'unable to delete equipment'
        });
      }
    });
  },

  changeStatus: (regNo, data) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Find the equipment by registration number
        const equipment = await equipmentModel.findById(id);

        if (!equipment) {
          return reject({
            status: 404,
            ok: false,
            message: 'Equipment not found with the provided registration number'
          });
        }

        // Get the request body data (status and optional site)
        const { status } = data;

        if (!status) {
          return reject({
            status: 400,
            ok: false,
            message: 'Status is required'
          });
        }

        // Store original status for notification
        const originalStatus = equipment.status;

        // Prepare update object
        const updateData = {
          status: status,
          updatedAt: new Date()
        };

        // Update the equipment
        const updatedEquipment = await equipmentModel.findOneAndUpdate(
          { regNo: regNo },
          updateData,
          { new: true, runValidators: true }
        );

        if (!updatedEquipment) {
          return reject({
            status: 500,
            ok: false,
            message: 'Failed to update equipment status'
          });
        }

        // Send notification for status change
        try {
          const notification = await createNotification({
            title: `${updatedEquipment.machine} - ${updatedEquipment.regNo} - ${status} now`,
            description: `${updatedEquipment.machine} - ${updatedEquipment.regNo} is in ${status} now`,
            priority: "high",
            sourceId: updatedEquipment._id,
            time: new Date()
          });

          await PushNotificationService.sendGeneralNotification(
            null, // broadcast to all users
            `${updatedEquipment.machine} - ${updatedEquipment.regNo} - ${status} now`, //title
            `${updatedEquipment.machine} - ${updatedEquipment.regNo} is in ${status} now`, //decription
            'high', //priority
            'normal', // type
            notification.data._id.toString()
          );
        } catch (notificationError) {
          console.error('Failed to send notification for status change:', notificationError);
          // Don't reject the main operation if notification fails
        }

        resolve({
          status: 200,
          ok: true,
          message: 'Equipment status updated successfully',
          data: updatedEquipment
        });

      } catch (error) {
        console.error('Error updating equipment status:', error);
        reject({
          status: 500,
          ok: false,
          message: 'Unable to change status',
          error: error.message
        });
      }
    });
  },

  addEquipmentImage: (equipmentNo, imagePath, imageLabel, fileName, mimeType) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Convert equipmentNo to string and ensure all required fields are present
        const equipmentNoStr = equipmentNo.toString();

        // Validate required fields
        if (!imagePath || !imageLabel) {
          return reject({
            status: 400,
            success: false,
            message: 'Image path and label are required'
          });
        }

        // Use findOneAndUpdate with upsert to handle both create and update in one atomic operation
        const equipment = await EquipmentImageModel.findOneAndUpdate(
          { equipmentNo: equipmentNoStr },
          {
            $push: {
              images: {
                path: imagePath,
                label: imageLabel,
                fileName: fileName,
                mimeType: mimeType
              }
            },
            $set: {
              updatedAt: new Date()
            },
            $setOnInsert: {
              equipmentName: `Equipment ${equipmentNoStr}`,
              createdAt: new Date()
            }
          },
          {
            upsert: true, // Create if doesn't exist
            new: true,    // Return updated document
            runValidators: true
          }
        );

        const isNewEquipment = equipment.images.length === 1;

        resolve({
          status: 200,
          success: true,
          message: isNewEquipment ? 'Equipment created with image successfully' : 'Image added to existing equipment successfully',
          data: {
            equipmentNo: equipmentNoStr,
            equipmentName: equipment.equipmentName,
            totalImages: equipment.images.length,
            imagePath,
            imageLabel,
            fileName,
            isNewEquipment
          }
        });

      } catch (error) {
        console.error('Error adding equipment image:', error);

        if (error.name === 'ValidationError') {
          reject({
            status: 400,
            success: false,
            message: 'Validation error: ' + error.message,
            error: error.message
          });
        } else {
          reject({
            status: 500,
            success: false,
            message: 'Failed to add equipment image',
            error: error.message
          });
        }
      }
    });
  },

  getEquipmentRegNo: (regNo) => {
    return new Promise(async (resolve, reject) => {
      try {
        const equipment = await EquipmentImageModel.findOne({ equipmentNo: regNo });

        if (!equipment) {
          return resolve({
            status: 404,
            success: false,
            message: 'Equipment not found'
          });
        }

        const result = equipment.toObject();

        if (result.images && result.images.length > 0) {
          result.images = result.images.map(image => {
            let imagePath = image.path;

            // Remove 'public' from the beginning of the path in all variations
            if (imagePath.startsWith('public/')) {
              imagePath = imagePath.substring(7); // Remove 'public/'
            } else if (imagePath.startsWith('/public/')) {
              imagePath = imagePath.substring(8); // Remove '/public/'
            } else if (imagePath.startsWith('public\\')) {
              imagePath = imagePath.substring(7); // Remove 'public\'
            } else if (imagePath.startsWith('\\public\\')) {
              imagePath = imagePath.substring(8); // Remove '\public\'
            }

            // Convert backslashes to forward slashes
            imagePath = imagePath.replace(/\\/g, '/');

            return {
              ...image,
              url: `/${imagePath}`
            };
          });
        }

        resolve({
          status: 200,
          success: true,
          message: 'Equipment details retrieved successfully',
          data: result
        });
      } catch (error) {
        console.error('Error retrieving equipment details:', error);
        reject({
          status: 500,
          success: false,
          message: 'Failed to retrieve equipment details',
          error: error.message
        });
      }
    });
  },

  getBulkEquipmentImages: (regNos) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Fetch all equipment images in one query using $in operator
        const equipmentHandovers = await EquipmentImageModel.find({
          equipmentNo: { $in: regNos }
        }).lean();

        // Create a map of regNo -> images
        const imagesMap = {};

        // Initialize all regNos with empty arrays
        regNos.forEach(regNo => {
          imagesMap[regNo] = {
            success: false,
            images: []
          };
        });

        // Process found equipment
        equipmentHandovers.forEach(equipment => {
          let images = [];

          if (equipment.images && equipment.images.length > 0) {
            images = equipment.images.map(image => {
              let imagePath = image.path;

              // Remove 'public' from the beginning of the path
              if (imagePath.startsWith('public/')) {
                imagePath = imagePath.substring(7);
              } else if (imagePath.startsWith('/public/')) {
                imagePath = imagePath.substring(8);
              } else if (imagePath.startsWith('public\\')) {
                imagePath = imagePath.substring(7);
              } else if (imagePath.startsWith('\\public\\')) {
                imagePath = imagePath.substring(8);
              }

              // Convert backslashes to forward slashes
              imagePath = imagePath.replace(/\\/g, '/');

              return {
                ...image,
                path: image.path,
                url: `/${imagePath}`
              };
            });
          }

          imagesMap[equipment.equipmentNo] = {
            success: true,
            images: images
          };
        });

        resolve({
          status: 200,
          success: true,
          message: 'Bulk equipment images retrieved successfully',
          data: imagesMap,
          totalRequested: regNos.length,
          totalFound: equipmentHandovers.length
        });
      } catch (error) {
        console.error('Error retrieving bulk equipment images:', error);
        reject({
          status: 500,
          success: false,
          message: 'Failed to retrieve bulk equipment images',
          error: error.message
        });
      }
    });
  },

  fetchEquipmentStats: function (hiredFilter = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // Build query based on hiredFilter
        let query = {};
        if (hiredFilter === 'hired') {
          query.hired = true;
        } else if (hiredFilter === 'own') {
          query.hired = false;
        }

        // Get total count
        const totalCount = await equipmentModel.countDocuments(query);

        // Get counts for each status using aggregation for better performance
        const statusCounts = await equipmentModel.aggregate([
          { $match: query },
          {
            $group: {
              _id: { $toLower: "$status" },
              count: { $sum: 1 }
            }
          }
        ]);

        // Convert aggregation result to object
        const stats = {
          total: totalCount,
          idle: 0,
          active: 0,
          maintenance: 0,
          loading: 0,
          going: 0,
          unknown: 0
        };

        // Map aggregation results to stats object
        statusCounts.forEach(item => {
          const status = item._id;
          if (stats.hasOwnProperty(status)) {
            stats[status] = item.count;
          } else {
            stats.unknown += item.count;
          }
        });

        // Get additional stats
        const companyStats = await equipmentModel.aggregate([
          { $match: query },
          {
            $group: {
              _id: "$company",
              count: { $sum: 1 }
            }
          }
        ]);

        // Get site distribution (most recent site per equipment)
        const siteStats = await equipmentModel.aggregate([
          { $match: query },
          { $unwind: "$site" },
          {
            $group: {
              _id: null,
              sites: { $last: "$site" }
            }
          },
          {
            $group: {
              _id: "$sites",
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ]);

        resolve({
          status: 200,
          ok: true,
          stats: {
            statusBreakdown: stats,
            companyBreakdown: companyStats.reduce((acc, item) => {
              acc[item._id] = item.count;
              return acc;
            }, {}),
            siteBreakdown: siteStats.reduce((acc, item) => {
              acc[item._id] = item.count;
              return acc;
            }, {}),
            totalEquipment: totalCount
          }
        });
      } catch (error) {
        console.error('Error fetching equipment stats:', error);
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching equipment statistics'
        });
      }
    });
  },
  fetchEquipmentsByStatus: function (status, page = 1, limit = 20, hiredFilter = null) {
    return new Promise(async (resolve, reject) => {
      try {
        const skip = (page - 1) * limit;

        // Build query based on hiredFilter
        let query = {};
        if (hiredFilter === 'hired') {
          query.hired = true;
        } else if (hiredFilter === 'own') {
          query.hired = false;
        }

        // Add status filter if not 'all'
        if (status && status !== 'all') {
          query.status = { $regex: new RegExp(`^${status}$`, 'i') }; // Case insensitive exact match
        }

        // Get total count
        const totalCount = await equipmentModel.countDocuments(query);

        // Fetch paginated data
        const equipments = await equipmentModel.find(query)
          .sort({ year: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        const totalPages = Math.ceil(totalCount / limit);

        resolve({
          status: 200,
          ok: true,
          equipments,
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages
        });
      } catch (error) {
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching equipments by status'
        });
      }
    });
  },
  mobilizeEquipment: async function (data) {
    try {
      const {
        equipmentId,  // This is now _id (ObjectId) from frontend
        regNo,
        machine,
        site,
        operator,
        operatorId,
        withOperator,
        month,
        year,
        time,
        remarks
      } = data;

      const mobilization = new mobilizationModel({
        equipmentId,  // Now ObjectId
        regNo,
        machine,
        action: 'mobilized',
        site,
        operator: withOperator ? operator : undefined,
        withOperator,
        month,
        year,
        date: new Date(),
        time,
        remarks,
        status: 'active'
      });

      await mobilization.save();

      const updateData = {
        status: 'active',
        site: [site],
        updatedAt: new Date()
      };

      const updateOperation = { $set: updateData };

      if (withOperator && operator && operatorId) {
        updateOperation.$push = {
          certificationBody: {
            operatorName: operator,
            operatorId: operatorId,
            assignedAt: new Date()
          }
        };
      }

      // ✅ Change from { id: equipmentId } to { _id: equipmentId }
      const updatedEquipment = await equipmentModel.findOneAndUpdate(
        { _id: equipmentId },  // Use _id instead of id
        updateOperation,
        { new: true }
      );

      if (!updatedEquipment) {
        return {
          status: 404,
          ok: false,
          message: 'Equipment not found'
        };
      }

      return {
        status: 201,
        ok: true,
        message: 'Equipment mobilized successfully',
        data: {
          mobilization,
          updatedEquipment
        }
      };
    } catch (error) {
      console.error('Error in mobilizeEquipment service:', error);
      throw error;
    }
  },

  demobilizeEquipment: async function (data) {
    try {
      const {
        equipmentId,  // Now ObjectId
        regNo,
        machine,
        month,
        year,
        time,
        remarks
      } = data;

      const demobilization = new mobilizationModel({
        equipmentId,
        regNo,
        machine,
        action: 'demobilized',
        withOperator: false,
        month,
        year,
        date: new Date(),
        time,
        remarks,
        status: 'idle'
      });

      await demobilization.save();

      // ✅ Change from { id: equipmentId } to { _id: equipmentId }
      const updatedEquipment = await equipmentModel.findOneAndUpdate(
        { _id: equipmentId },  // Use _id instead of id
        {
          $set: {
            status: 'idle',
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (!updatedEquipment) {
        return {
          status: 404,
          ok: false,
          message: 'Equipment not found'
        };
      }

      return {
        status: 201,
        ok: true,
        message: 'Equipment demobilized successfully',
        data: {
          demobilization,
          updatedEquipment
        }
      };
    } catch (error) {
      console.error('Error in demobilizeEquipment service:', error);
      throw error;
    }
  },

  getMobilizationHistory: async function (equipmentId, page, limit) {
    try {
      const skip = (page - 1) * limit;

      const history = await mobilizationModel.find({ equipmentId })
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalCount = await mobilizationModel.countDocuments({ equipmentId });
      const totalPages = Math.ceil(totalCount / limit);

      return {
        history,
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages
      };
    } catch (error) {
      console.error('Error in getMobilizationHistory service:', error);
      throw error;
    }
  },

  replaceOperator: async function (data) {
    try {
      const {
        equipmentId,  // Now ObjectId
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
      } = data;

      const replacement = new replacementsModel({
        equipmentId,
        regNo,
        machine,
        date: new Date(),
        month,
        year,
        time,
        status: 'active',
        type: 'operator',
        currentOperator,
        currentOperatorId,
        replacedOperator,
        replacedOperatorId,
        remarks
      });

      await replacement.save();

      // ✅ Change from { id: equipmentId } to { _id: equipmentId }
      const updatedEquipment = await equipmentModel.findOneAndUpdate(
        { _id: equipmentId },  // Use _id instead of id
        {
          $push: {
            certificationBody: {
              operatorName: replacedOperator,
              operatorId: replacedOperatorId,
              assignedAt: new Date()
            }
          },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );

      if (!updatedEquipment) {
        return {
          status: 404,
          ok: false,
          message: 'Equipment not found'
        };
      }

      return {
        status: 201,
        ok: true,
        message: 'Operator replaced successfully',
        data: {
          replacement,
          updatedEquipment
        }
      };
    } catch (error) {
      console.error('Error in replaceOperator service:', error);
      throw error;
    }
  },

  replaceEquipment: async function (data) {
    try {
      const {
        equipmentId,  // Now ObjectId
        regNo,
        machine,
        replacedEquipmentId,  // Now ObjectId
        replacedEquipmentRegNo,
        replacedEquipmentMachine,
        newSiteForReplaced,
        month,
        year,
        time,
        remarks
      } = data;

      // ✅ Change from { id: equipmentId } to { _id: equipmentId }
      const currentEquipment = await equipmentModel.findOne({ _id: equipmentId });

      if (!currentEquipment) {
        return {
          status: 404,
          ok: false,
          message: 'Current equipment not found'
        };
      }

      const currentSite = currentEquipment.site && currentEquipment.site.length > 0
        ? currentEquipment.site[0]
        : null;

      if (!currentSite) {
        return {
          status: 400,
          ok: false,
          message: 'Current equipment has no site assigned'
        };
      }

      const replacement = new replacementsModel({
        equipmentId,
        regNo,
        machine,
        date: new Date(),
        month,
        year,
        time,
        status: 'active',
        type: 'equipment',
        replacedEquipmentId,
        remarks
      });

      await replacement.save();

      // ✅ Change from { id: replacedEquipmentId } to { _id: replacedEquipmentId }
      const updatedReplacedEquipment = await equipmentModel.findOneAndUpdate(
        { _id: replacedEquipmentId },  // Use _id instead of id
        {
          $set: {
            site: [currentSite],
            status: 'active',
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (!updatedReplacedEquipment) {
        return {
          status: 404,
          ok: false,
          message: 'Replacement equipment not found'
        };
      }

      let currentEquipmentUpdate;
      if (newSiteForReplaced) {
        currentEquipmentUpdate = {
          site: [newSiteForReplaced],
          status: 'active',
          updatedAt: new Date()
        };
      } else {
        currentEquipmentUpdate = {
          site: [],
          status: 'idle',
          updatedAt: new Date()
        };
      }

      // ✅ Change from { id: equipmentId } to { _id: equipmentId }
      const updatedCurrentEquipment = await equipmentModel.findOneAndUpdate(
        { _id: equipmentId },  // Use _id instead of id
        { $set: currentEquipmentUpdate },
        { new: true }
      );

      return {
        status: 201,
        ok: true,
        message: 'Equipment replaced successfully',
        data: {
          replacement,
          currentEquipment: updatedCurrentEquipment,
          replacedEquipment: updatedReplacedEquipment
        }
      };
    } catch (error) {
      console.error('Error in replaceEquipment service:', error);
      throw error;
    }
  },

  getReplacementHistory: async function (equipmentId, page, limit, type) {
    try {
      const skip = (page - 1) * limit;

      // Build query
      const query = { equipmentId };
      if (type) {
        query.type = type;
      }

      const history = await replacementsModel.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalCount = await replacementsModel.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limit);

      return {
        history,
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages
      };
    } catch (error) {
      console.error('Error in getReplacementHistory service:', error);
      throw error;
    }
  },
  fetchUniqueSites: async function () {
    try {
      const sites = await equipmentModel.distinct('site');

      // Flatten nested arrays and remove duplicates
      const uniqueSites = [...new Set(sites.flat())].filter(site => site && site.trim() !== '');

      // Sort alphabetically
      uniqueSites.sort();

      return uniqueSites;
    } catch (error) {
      console.error('Error fetching unique sites:', error);
      throw error;
    }
  },
  fetchUniqueSites: async function () {
    try {
      const sites = await equipmentModel.distinct('site');

      // Flatten nested arrays and remove duplicates
      const uniqueSites = [...new Set(sites.flat())].filter(site => site && site.trim() !== '');

      // Sort alphabetically
      uniqueSites.sort();

      return uniqueSites;
    } catch (error) {
      console.error('Error fetching unique sites:', error);
      throw error;
    }
  },

  fetchAllMobilizations: async function () {
    try {
      const mobilizations = await mobilizationModel.find({})
        .sort({ date: -1, createdAt: -1 })
        .limit(100)
        .lean();

      // Get unique equipment regNos
      const regNos = [...new Set(mobilizations.map(m => m.regNo))];

      // Fetch equipment details in bulk
      const equipments = await equipmentModel.find({
        regNo: { $in: regNos }
      }).lean();

      // Fetch equipment images in bulk
      const equipmentImages = await EquipmentImageModel.find({
        equipmentNo: { $in: regNos }
      }).lean();

      // Fetch operator details if needed
      const operatorNames = [...new Set(
        mobilizations
          .filter(m => m.operator)
          .map(m => m.operator)
      )];

      let operators = [];
      if (operatorNames.length > 0) {
        operators = await OperatorService.getOperatorsByNames(operatorNames);
      }

      // Create maps for quick lookup
      const equipmentMap = {};
      equipments.forEach(eq => {
        equipmentMap[eq.regNo] = eq;
      });

      const imageMap = {};
      equipmentImages.forEach(img => {
        imageMap[img.equipmentNo] = img.images?.map(image => {
          let imagePath = image.path;
          if (imagePath.startsWith('public/')) imagePath = imagePath.substring(7);
          else if (imagePath.startsWith('/public/')) imagePath = imagePath.substring(8);
          imagePath = imagePath.replace(/\\/g, '/');

          return {
            ...image,
            url: `/${imagePath}`
          };
        }) || [];
      });

      const operatorMap = {};
      operators.forEach(op => {
        operatorMap[op.name] = op;
      });

      // Enrich mobilizations with equipment and operator details
      const enrichedMobilizations = mobilizations.map(mob => {
        const equipment = equipmentMap[mob.regNo] || {};
        const images = imageMap[mob.regNo] || [];
        const operator = mob.operator ? operatorMap[mob.operator] : null;

        return {
          ...mob,
          equipmentDetails: {
            id: equipment.id,
            machine: equipment.machine || mob.machine,
            regNo: equipment.regNo || mob.regNo,
            brand: equipment.brand,
            year: equipment.year,
            company: equipment.company,
            status: equipment.status
          },
          equipmentImages: images,
          operatorDetails: operator ? {
            name: operator.name,
            qatarId: operator.qatarId,
            contactNo: operator.contactNo,
            profilePic: operator.profilePic
          } : null
        };
      });

      return enrichedMobilizations;
    } catch (error) {
      console.error('Error fetching all mobilizations:', error);
      throw error;
    }
  },

  fetchAllReplacements: async function () {
    try {
      const replacements = await replacementsModel.find({})
        .sort({ date: -1, createdAt: -1 })
        .limit(100)
        .lean();

      // ✅ Get unique equipment ObjectIds (both current and replaced)
      const equipmentIds = [...new Set([
        ...replacements.map(r => r.equipmentId.toString()),
        ...replacements
          .filter(r => r.type === 'equipment' && r.replacedEquipmentId)
          .map(r => r.replacedEquipmentId.toString())
      ])];

      // ✅ Fetch all equipment by _id instead of id
      const equipments = await equipmentModel.find({
        _id: { $in: equipmentIds }
      }).lean();

      // Get all regNos for fetching images
      const allRegNos = [...new Set(equipments.map(eq => eq.regNo))];

      // Fetch equipment images for all regNos
      const equipmentImages = await EquipmentImageModel.find({
        equipmentNo: { $in: allRegNos }
      }).lean();

      // ✅ Fetch operator details BY ID instead of by name
      const operatorIds = [...new Set([
        ...replacements.filter(r => r.currentOperatorId).map(r => r.currentOperatorId),
        ...replacements.filter(r => r.replacedOperatorId).map(r => r.replacedOperatorId)
      ])];

      let operators = [];
      if (operatorIds.length > 0) {
        operators = await OperatorService.getOperatorsByIds(operatorIds);
      }

      // ✅ Create maps using _id as string keys
      const equipmentMapById = {};
      const equipmentMapByRegNo = {};
      equipments.forEach(eq => {
        equipmentMapById[eq._id.toString()] = eq;  // Convert ObjectId to string
        equipmentMapByRegNo[eq.regNo] = eq;
      });

      const imageMap = {};
      equipmentImages.forEach(img => {
        imageMap[img.equipmentNo] = img.images?.map(image => {
          let imagePath = image.path;
          if (imagePath.startsWith('public/')) imagePath = imagePath.substring(7);
          else if (imagePath.startsWith('/public/')) imagePath = imagePath.substring(8);
          else if (imagePath.startsWith('public\\')) imagePath = imagePath.substring(7);
          else if (imagePath.startsWith('\\public\\')) imagePath = imagePath.substring(8);
          imagePath = imagePath.replace(/\\/g, '/');

          return {
            ...image,
            url: `/${imagePath}`
          };
        }) || [];
      });

      // ✅ Create operator map by ID instead of by name
      const operatorMap = {};
      operators.forEach(op => {
        operatorMap[op._id.toString()] = op; // Convert ObjectId to string for consistent lookup
      });

      // ✅ Enrich replacements with equipment and operator details
      const enrichedReplacements = replacements.map(rep => {
        const currentEquipment = equipmentMapById[rep.equipmentId.toString()] || {};
        const currentImages = imageMap[currentEquipment.regNo] || [];

        let replacedEquipmentDetails = null;
        let replacedEquipmentImages = [];

        // For equipment replacements, get replaced equipment details
        if (rep.type === 'equipment' && rep.replacedEquipmentId) {
          const replacedEquipment = equipmentMapById[rep.replacedEquipmentId.toString()] || {};
          replacedEquipmentImages = imageMap[replacedEquipment.regNo] || [];

          replacedEquipmentDetails = {
            id: replacedEquipment._id,
            machine: replacedEquipment.machine,
            regNo: replacedEquipment.regNo,
            brand: replacedEquipment.brand,
            year: replacedEquipment.year,
            company: replacedEquipment.company,
            status: replacedEquipment.status,
            site: replacedEquipment.site?.[0] || replacedEquipment.site,
            images: replacedEquipmentImages
          };
        }

        // ✅ Get operator details by ID
        const currentOperatorDetails = rep.currentOperatorId ? operatorMap[rep.currentOperatorId] : null;
        const replacedOperatorDetails = rep.replacedOperatorId ? operatorMap[rep.replacedOperatorId] : null;

        return {
          ...rep,
          currentEquipmentDetails: {
            id: currentEquipment._id,
            machine: currentEquipment.machine || rep.machine,
            regNo: currentEquipment.regNo || rep.regNo,
            brand: currentEquipment.brand,
            year: currentEquipment.year,
            company: currentEquipment.company,
            status: currentEquipment.status,
            site: currentEquipment.site?.[0] || currentEquipment.site,
            images: currentImages
          },
          replacedEquipmentDetails,
          currentOperatorDetails: currentOperatorDetails ? {
            id: currentOperatorDetails._id || currentOperatorDetails.id,
            name: currentOperatorDetails.name,
            qatarId: currentOperatorDetails.qatarId,
            contactNo: currentOperatorDetails.contactNo,
            profilePic: currentOperatorDetails.profilePic
          } : null,
          replacedOperatorDetails: replacedOperatorDetails ? {
            id: replacedOperatorDetails._id || replacedOperatorDetails.id,
            name: replacedOperatorDetails.name,
            qatarId: replacedOperatorDetails.qatarId,
            contactNo: replacedOperatorDetails.contactNo,
            profilePic: replacedOperatorDetails.profilePic
          } : null
        };
      });

      return enrichedReplacements;
    } catch (error) {
      console.error('Error fetching all replacements:', error);
      throw error;
    }
  },
  fetchFilteredMobilizations: async function (filterType, startDate = null, endDate = null, months = null, specificTime = null, startTime = null, endTime = null) {
    try {
      let query = {};
      let startDateTime, endDateTime;

      switch (filterType) {
        case 'daily':
          // Today's mobilizations
          startDateTime = new Date();
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'yesterday':
          // Yesterday's mobilizations
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 1);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setDate(endDateTime.getDate() - 1);
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'weekly':
          // Last 7 days
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 7);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'monthly':
          // Last 30 days
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 30);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'yearly':
          // Last 365 days
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 365);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'months':
          // Last X months
          if (!months) months = 1;
          startDateTime = new Date();
          startDateTime.setMonth(startDateTime.getMonth() - parseInt(months));
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        // 🆕 NEW: Single date filter
        case 'single':
          // Single date (DD-MM-YYYY format from frontend)
          if (!startDate) {
            throw new Error('Date is required for single date filter');
          }
          const [singleDay, singleMonth, singleYear] = startDate.split('-');
          startDateTime = new Date(singleYear, singleMonth - 1, singleDay, 0, 0, 0, 0);
          endDateTime = new Date(singleYear, singleMonth - 1, singleDay, 23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'custom':
          // Date range (DD-MM-YYYY format from frontend)
          if (!startDate || !endDate) {
            throw new Error('Start date and end date are required for custom range');
          }

          // Parse DD-MM-YYYY to Date
          const [startDay, startMonth, startYear] = startDate.split('-');
          const [endDay, endMonth, endYear] = endDate.split('-');

          startDateTime = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
          endDateTime = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        default:
          // Default to last 30 days
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 30);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
      }

      if (specificTime) {
        query.time = specificTime;
      } else if (startTime && endTime) {
        query.time = { $gte: startTime, $lte: endTime };
      }

      const mobilizations = await mobilizationModel.find(query)
        .sort({ date: -1, createdAt: -1 })
        .limit(500)
        .lean();

      // Get unique equipment regNos
      const regNos = [...new Set(mobilizations.map(m => m.regNo))];

      // Fetch equipment details in bulk
      const equipments = await equipmentModel.find({
        regNo: { $in: regNos }
      }).lean();

      // Fetch equipment images in bulk
      const equipmentImages = await EquipmentImageModel.find({
        equipmentNo: { $in: regNos }
      }).lean();

      // Fetch operator details if needed
      const operatorNames = [...new Set(
        mobilizations
          .filter(m => m.operator)
          .map(m => m.operator)
      )];

      let operators = [];
      if (operatorNames.length > 0) {
        operators = await OperatorService.getOperatorsByNames(operatorNames);
      }

      // Create maps for quick lookup
      const equipmentMap = {};
      equipments.forEach(eq => {
        equipmentMap[eq.regNo] = eq;
      });

      const imageMap = {};
      equipmentImages.forEach(img => {
        imageMap[img.equipmentNo] = img.images?.map(image => {
          let imagePath = image.path;
          if (imagePath.startsWith('public/')) imagePath = imagePath.substring(7);
          else if (imagePath.startsWith('/public/')) imagePath = imagePath.substring(8);
          imagePath = imagePath.replace(/\\/g, '/');

          return {
            ...image,
            url: `/${imagePath}`
          };
        }) || [];
      });

      const operatorMap = {};
      operators.forEach(op => {
        operatorMap[op.name] = op;
      });

      // Enrich mobilizations with equipment and operator details
      const enrichedMobilizations = mobilizations.map(mob => {
        const equipment = equipmentMap[mob.regNo] || {};
        const images = imageMap[mob.regNo] || [];
        const operator = mob.operator ? operatorMap[mob.operator] : null;

        return {
          ...mob,
          equipmentDetails: {
            id: equipment.id,
            machine: equipment.machine || mob.machine,
            regNo: equipment.regNo || mob.regNo,
            brand: equipment.brand,
            year: equipment.year,
            company: equipment.company,
            status: equipment.status,
            site: equipment.site?.[0] || equipment.site
          },
          equipmentImages: images,
          operatorDetails: operator ? {
            name: operator.name,
            qatarId: operator.qatarId,
            contactNo: operator.contactNo,
            profilePic: operator.profilePic
          } : null
        };
      });

      return enrichedMobilizations;
    } catch (error) {
      console.error('Error fetching filtered mobilizations:', error);
      throw error;
    }
  },

  fetchFilteredReplacements: async function (filterType, startDate = null, endDate = null, months = null) {
    try {
      let query = {};
      let startDateTime, endDateTime;

      switch (filterType) {
        case 'daily':
          startDateTime = new Date();
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'yesterday':
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 1);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setDate(endDateTime.getDate() - 1);
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'weekly':
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 7);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'monthly':
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 30);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'yearly':
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 365);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'months':
          if (!months) months = 1;
          startDateTime = new Date();
          startDateTime.setMonth(startDateTime.getMonth() - parseInt(months));
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        case 'custom':
          if (!startDate || !endDate) {
            throw new Error('Start date and end date are required for custom range');
          }

          const [startDay, startMonth, startYear] = startDate.split('-');
          const [endDay, endMonth, endYear] = endDate.split('-');

          startDateTime = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
          endDateTime = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

          query.date = { $gte: startDateTime, $lte: endDateTime };
          break;

        default:
          startDateTime = new Date();
          startDateTime.setDate(startDateTime.getDate() - 30);
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime = new Date();
          endDateTime.setHours(23, 59, 59, 999);
          query.date = { $gte: startDateTime, $lte: endDateTime };
      }

      const replacements = await replacementsModel.find(query)
        .sort({ date: -1, createdAt: -1 })
        .limit(500)
        .lean();

      // ✅ Get unique equipment ObjectIds (both current and replaced)
      const equipmentIds = [...new Set([
        ...replacements.map(r => r.equipmentId.toString()),
        ...replacements
          .filter(r => r.type === 'equipment' && r.replacedEquipmentId)
          .map(r => r.replacedEquipmentId.toString())
      ])];

      // ✅ Fetch all equipment by _id
      const equipments = await equipmentModel.find({
        _id: { $in: equipmentIds }
      }).lean();

      // Fetch equipment images for all regNos
      const allRegNos = [...new Set(equipments.map(eq => eq.regNo))];

      const equipmentImages = await EquipmentImageModel.find({
        equipmentNo: { $in: allRegNos }
      }).lean();

      // ✅ Fetch operator details BY ID instead of by name
      const operatorIds = [...new Set([
        ...replacements.filter(r => r.currentOperatorId).map(r => r.currentOperatorId),
        ...replacements.filter(r => r.replacedOperatorId).map(r => r.replacedOperatorId)
      ])];

      let operators = [];
      if (operatorIds.length > 0) {
        operators = await this.getOperatorsByIds(operatorIds);
      }

      // ✅ Create maps using _id as string keys
      const equipmentMapById = {};
      const equipmentMapByRegNo = {};
      equipments.forEach(eq => {
        equipmentMapById[eq._id.toString()] = eq;
        equipmentMapByRegNo[eq.regNo] = eq;
      });

      const imageMap = {};
      equipmentImages.forEach(img => {
        imageMap[img.equipmentNo] = img.images?.map(image => {
          let imagePath = image.path;
          if (imagePath.startsWith('public/')) imagePath = imagePath.substring(7);
          else if (imagePath.startsWith('/public/')) imagePath = imagePath.substring(8);
          imagePath = imagePath.replace(/\\/g, '/');

          return {
            ...image,
            url: `/${imagePath}`
          };
        }) || [];
      });

      // ✅ Create operator map by ID
      const operatorMap = {};
      operators.forEach(op => {
        operatorMap[op._id.toString()] = op;
      });

      // ✅ Enrich replacements
      const enrichedReplacements = replacements.map(rep => {
        const currentEquipment = equipmentMapById[rep.equipmentId.toString()] || {};
        const currentImages = imageMap[currentEquipment.regNo] || [];

        let replacedEquipmentDetails = null;
        let replacedEquipmentImages = [];

        // For equipment replacements, get replaced equipment details
        if (rep.type === 'equipment' && rep.replacedEquipmentId) {
          const replacedEquipment = equipmentMapById[rep.replacedEquipmentId.toString()] || {};
          replacedEquipmentImages = imageMap[replacedEquipment.regNo] || [];

          replacedEquipmentDetails = {
            id: replacedEquipment._id,
            machine: replacedEquipment.machine,
            regNo: replacedEquipment.regNo,
            brand: replacedEquipment.brand,
            year: replacedEquipment.year,
            company: replacedEquipment.company,
            status: replacedEquipment.status,
            site: replacedEquipment.site?.[0] || replacedEquipment.site,
            images: replacedEquipmentImages
          };
        }

        // ✅ Get operator details by ID
        const currentOperatorDetails = rep.currentOperatorId ? operatorMap[rep.currentOperatorId] : null;
        const replacedOperatorDetails = rep.replacedOperatorId ? operatorMap[rep.replacedOperatorId] : null;

        return {
          ...rep,
          currentEquipmentDetails: {
            id: currentEquipment._id,
            machine: currentEquipment.machine || rep.machine,
            regNo: currentEquipment.regNo || rep.regNo,
            brand: currentEquipment.brand,
            year: currentEquipment.year,
            company: currentEquipment.company,
            status: currentEquipment.status,
            site: currentEquipment.site?.[0] || currentEquipment.site,
            images: currentImages
          },
          replacedEquipmentDetails,
          currentOperatorDetails: currentOperatorDetails ? {
            id: currentOperatorDetails._id || currentOperatorDetails.id,
            name: currentOperatorDetails.name,
            qatarId: currentOperatorDetails.qatarId,
            contactNo: currentOperatorDetails.contactNo,
            profilePic: currentOperatorDetails.profilePic
          } : null,
          replacedOperatorDetails: replacedOperatorDetails ? {
            id: replacedOperatorDetails._id || replacedOperatorDetails.id,
            name: replacedOperatorDetails.name,
            qatarId: replacedOperatorDetails.qatarId,
            contactNo: replacedOperatorDetails.contactNo,
            profilePic: replacedOperatorDetails.profilePic
          } : null
        };
      });

      return enrichedReplacements;
    } catch (error) {
      console.error('Error fetching filtered replacements:', error);
      throw error;
    }
  },
  getOperatorsByIds: async function (operatorIds) {
    try {
      const operators = await OperatorModel.find({
        _id: { $in: operatorIds }
      }).lean();

      return operators;
    } catch (error) {
      console.error('Error fetching operators by IDs:', error);
      throw error;
    }
  }
}