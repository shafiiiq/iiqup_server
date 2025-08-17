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

        data.id = equipments.length + 1

        const equipment = await equipmentModel.create(data);

        // Send notification for new equipment
        try {
          await createNotification({
            title: "New Equipment Added",
            description: `Congratulations! We have bought a brand new ${equipment.machine} (${equipment.brand}) today`,
            priority: "high",
            sourceId: equipment._id,
            time: new Date()
          });

          await PushNotificationService.sendGeneralNotification(
            null, // broadcast to all users
            "New Equipment Added", //title
            `Congratulations! We have bought a brand new ${equipment.machine} (${equipment.brand}) today`, //decription
            'high', //priority
            'normal' // type
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
        reject({
          status: 500,
          ok: false,
          message: 'Missing data or an error occurred',
          error: err.message
        });
      }
    });

  },

  fetchEquipments: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const data = await equipmentModel.find({ outside: false });
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

  updateEquipments: (regNo, updatedData) => {
    return new Promise(async (resolve, reject) => {
      try {
        const equipment = await equipmentModel.findOne({ regNo: regNo });
        if (!equipment) {
          return reject({ status: 404, ok: false, message: 'Equipment not found' });
        }

        // Store original data for notification comparison
        const originalEquipment = { ...equipment.toObject() };

        // Remove immutable fields that shouldn't be updated
        const { _id, __v, createdAt, ...cleanUpdatedData } = updatedData;

        // Handle operator addition to certificationBody
        let addedOperator = null;
        const updateData = { ...cleanUpdatedData };

        if (cleanUpdatedData.operator) {
          addedOperator = cleanUpdatedData.operator;
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

          console.log('Original updatedData.site:', updatedData.site);
          console.log('Type of updatedData.site:', typeof updatedData.site);

          // Check if site changed with proper type checking
          if (updatedData.site && JSON.stringify(originalEquipment.site) !== JSON.stringify(updatedData.site)) {
            let siteText;

            if (Array.isArray(updatedData.site)) {
              siteText = updatedData.site.join(', ');
            } else {
              siteText = String(updatedData.site); // Convert to string if it's not an array
            }

            changes.push(`site is: ${siteText}`);
          }

          // Check if certificationBody changed (compare array lengths or last item)
          if (JSON.stringify(originalEquipment.certificationBody) !== JSON.stringify(updatedData.certificationBody)) {
            // Ensure certificationBody is an array and has items
            if (Array.isArray(updatedData.certificationBody) && updatedData.certificationBody.length > 0) {
              const lastOperator = updatedData.certificationBody[updatedData.certificationBody.length - 1];
              changes.push(`operator is: ${lastOperator}`);
            }
          }

          if (changes.length > 0) {
            const changesText = changes.join(', ');

            await createNotification({
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
              'normal' // type
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
        console.error('Error in updateEquipments:', error); // Added logging
        reject({ status: 500, ok: false, message: 'Unable to update equipment' });
      }
    });
  },

  deleteEquipments: (regNo) => {
    return new Promise(async (resolve, reject) => {
      try {
        const validUser = await equipmentModel.findOne({ regNo: regNo });
        if (validUser) {
          const deleteUser = await equipmentModel.findOneAndDelete({ regNo: regNo });

          // Send notification for equipment deletion
          try {
            await createNotification({
              title: "Equipment Removed",
              description: `Equipment ${deleteUser.machine} - ${deleteUser.regNo} has been removed from the system`,
              priority: "medium",
              sourceId: deleteUser._id,
              time: new Date()
            });

            await PushNotificationService.sendGeneralNotification(
              null, // broadcast to all users
              'Equipment Removed', //title
              `Equipment ${deleteUser.machine} - ${deleteUser.regNo} has been removed from the system`, //decription
              'medium', //priority
              'normal' // type
            );
          } catch (notificationError) {
            console.error('Failed to send notification for equipment deletion:', notificationError);
            // Don't reject the main operation if notification fails
          }

          return resolve({
            status: 200,
            ok: true,
            message: 'Equipment deleted successfully',
            data: deleteUser
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
          await createNotification({
            title: "Equipment Status Changed",
            description: `Status of ${updatedEquipment.machine} - ${updatedEquipment.regNo} changed from ${originalStatus} to ${status}`,
            priority: "high",
            sourceId: updatedEquipment._id,
            time: new Date()
          });

          await PushNotificationService.sendGeneralNotification(
            null, // broadcast to all users
            'Equipment Status Changed', //title
            `Status of ${updatedEquipment.machine} - ${updatedEquipment.regNo} changed from ${originalStatus} to ${status}`, //decription
            'high', //priority
            'normal' // type
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