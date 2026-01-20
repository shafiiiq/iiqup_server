const { promises } = require('fs');
const equipmentModel = require('../models/equip.model');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');
const EquipmentImageModel = require('../models/equip-hand-over-stock.model');

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

  fetchEquipments: function (page = 1, limit = 20) {
    return new Promise(async (resolve, reject) => {
      try {
        const skip = (page - 1) * limit;

        // Query for non-outside equipment
        const query = { outside: false };

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

  searchEquipments: function (searchTerm, page = 1, limit = 20, searchField = 'all') {
    return new Promise(async (resolve, reject) => {
      try {
        const skip = (page - 1) * limit;

        // Base query - exclude outside equipment
        let query = { outside: false };

        // Build search query based on searchField
        if (searchField === 'all') {
          // Search across multiple fields
          query.$or = [
            { machine: { $regex: searchTerm, $options: 'i' } },
            { regNo: { $regex: searchTerm, $options: 'i' } },
            { brand: { $regex: searchTerm, $options: 'i' } },
            { company: { $regex: searchTerm, $options: 'i' } },
            { status: { $regex: searchTerm, $options: 'i' } },
            { site: { $regex: searchTerm, $options: 'i' } },
            { certificationBody: { $regex: searchTerm, $options: 'i' } },
            { coc: { $regex: searchTerm, $options: 'i' } }
          ];

          // Check if searchTerm is a number for year search
          if (!isNaN(searchTerm)) {
            query.$or.push({ year: parseInt(searchTerm) });
          }
        } else if (searchField === 'site') {
          // Site-specific search
          query.site = { $regex: searchTerm, $options: 'i' };
        } else {
          // Specific field search
          query[searchField] = { $regex: searchTerm, $options: 'i' };
        }

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
        const data = await equipmentModel.find({ outside: false, regNo: regNo });
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

  updateEquipments: (regNo, updatedData, equipmentNumber = null, operatorName = null) => {
    return new Promise(async (resolve, reject) => {
      try {
        //  Check for equipmentNumber and operatorName (not updateData === null)
        if (equipmentNumber && operatorName) {
          const equipment = await equipmentModel.findOne({ regNo: equipmentNumber });
          if (!equipment) {
            return reject({ status: 404, ok: false, message: 'Equipment not found' });
          }

          // Fixed: Properly update operator field
          const result = await equipmentModel.findOneAndUpdate(
            { regNo: equipmentNumber },
            { operator: operatorName }, // Fixed: Pass as object with operator field
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
            null, // broadcast to all users
            'Operator Updated', //title
            `${equipment.machine} - ${equipment.regNo}'s new operator is ${operatorName}`, //description
            'medium', //priority
            'normal', // type
            notification.data._id.toString()
          );

          return resolve({ // Added return
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

        // Store original data for notification comparison
        const originalEquipment = { ...equipment.toObject() };

        // Remove immutable fields that shouldn't be updated
        const { _id, __v, createdAt, ...cleanUpdatedData } = updatedData;

        // Handle operator addition to certificationBody
        const updateData = { ...cleanUpdatedData };

        if (cleanUpdatedData.operator) {
          // Use $push to add to certificationBody array
          updateData.$push = { certificationBody: cleanUpdatedData.operator };
          delete updateData.operator;
        }

        const result = await equipmentModel.findOneAndUpdate(
          { regNo: regNo },
          updateData,
          { new: true, runValidators: true }
        );

        // Send notification for equipment update
        try {
          const changes = [];

          // Check if site changed with proper type checking
          if (updatedData.site && JSON.stringify(originalEquipment.site) !== JSON.stringify(updatedData.site)) {
            let siteText;
            if (Array.isArray(updatedData.site)) {
              siteText = updatedData.site.join(', ');
            } else {
              siteText = String(updatedData.site);
            }
            changes.push(`site is: ${siteText}`);
          }

          // Fixed: Check against result's certificationBody, not updatedData
          if (result.certificationBody &&
            JSON.stringify(originalEquipment.certificationBody) !== JSON.stringify(result.certificationBody)) {
            if (Array.isArray(result.certificationBody) && result.certificationBody.length > 0) {
              const lastOperator = result.certificationBody[result.certificationBody.length - 1];
              changes.push(`operator is: ${lastOperator}`);
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
              null, // broadcast to all users
              'Equipment Updated', //title
              `${equipment.machine} - ${equipment.regNo}'s new ${changesText}`, //description
              'medium', //priority
              'normal', // type
              notification.data._id.toString()
            );
          }

        } catch (notificationError) {
          console.error('Failed to send notification for equipment update:', notificationError);
          // Don't reject the main operation if notification fails
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
        const equipment = await equipmentModel.findOne({ regNo: regNo });

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
}