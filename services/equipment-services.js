const { promises } = require('fs');
const equipmentModel = require('../models/equip.model');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');

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

  fetchEquipments: function () {
    return new Promise(async (resolve, reject) => {
      try {
        const sortConfig = {
          key: 'year',
          direction: 'desc' // desc for latest first, asc for oldest first
        }
        const data = await equipmentModel.find({ outside: false });
        const sortedResults = this.sortData(data, sortConfig.key, sortConfig.direction);
        resolve({
          status: 200,
          ok: true,
          data: sortedResults
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
  }
}