const stockHandoverModel = require('../models/equip-hand-over-stock.model');
const path = require('path');
const Stock = require('../models/stocks.model');
const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',
  // Add other configuration options as needed
}
const userServices = require('../services/user-services.js')
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');

module.exports = {
  insertEquipmentStocks: (data) => {

    return new Promise(async (resolve, reject) => {
      // Set a timeout for the entire operation
      const timeoutId = setTimeout(() => {
        reject({
          status: 408,
          success: false,
          message: 'Request timeout - operation took too long',
          error: 'TIMEOUT'
        });
      }, 30000); // 30 second timeout

      try {
        const {
          equipmentName,
          equipmentNo
        } = data;

        // Validate required fields
        if (!equipmentName || !equipmentNo) {
          clearTimeout(timeoutId);
          return resolve({
            status: 400,
            success: false,
            message: 'Equipment name and number are required'
          });
        }

        // Check for existing equipment with timeout
        const existingEquipment = await Promise.race([
          stockHandoverModel.findOne({ equipmentNo }).lean(), // .lean() for faster query
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Find operation timeout')), 10000)
          )
        ]);

        if (existingEquipment) {
          clearTimeout(timeoutId);
          return resolve({
            status: 201,
            success: true,
            message: 'Equipment with this number already exists',
            id: existingEquipment._id,
            data: existingEquipment,
            isExisting: true
          });
        }

        // Create new equipment record
        const newEquipment = new stockHandoverModel({
          equipmentName: equipmentName.trim(),
          equipmentNo: equipmentNo.trim(),
          images: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Save with timeout
        const savedEquipment = await Promise.race([
          newEquipment.save(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Save operation timeout')), 15000)
          )
        ]);

        clearTimeout(timeoutId);
        resolve({
          status: 201,
          success: true,
          message: 'Equipment data stored successfully',
          id: savedEquipment._id,
          data: savedEquipment,
          isExisting: false
        });

      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Error storing equipment data:', error);

        // Handle specific MongoDB errors
        if (error.code === 11000) {
          resolve({
            status: 409,
            success: false,
            message: 'Equipment number already exists or database constraint violation',
            error: 'DUPLICATE_KEY'
          });
        } else if (error.message.includes('timeout')) {
          reject({
            status: 408,
            success: false,
            message: 'Database operation timed out',
            error: 'DATABASE_TIMEOUT'
          });
        } else {
          reject({
            status: 500,
            success: false,
            message: 'Failed to store equipment data',
            error: error.message
          });
        }
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

        // Try to find existing equipment
        let equipment = await stockHandoverModel.findOne({ equipmentNo: equipmentNoStr });

        if (equipment) {
          // Equipment exists - add new image to existing array
          equipment.images.push({
            path: imagePath,
            label: imageLabel,
            fileName: fileName,
            mimeType: mimeType
          });

          equipment.updatedAt = new Date();
          await equipment.save();

          resolve({
            status: 200,
            success: true,
            message: 'Image added to existing equipment successfully',
            data: {
              equipmentNo: equipmentNoStr,
              equipmentName: equipment.equipmentName,
              totalImages: equipment.images.length,
              imagePath,
              imageLabel,
              fileName,
              isNewEquipment: false
            }
          });

        } else {
          // Equipment doesn't exist - create new one with image
          equipment = new stockHandoverModel({
            equipmentNo: equipmentNoStr,
            equipmentName: `Equipment ${equipmentNoStr}`, // Default name
            images: [{
              path: imagePath,
              label: imageLabel,
              fileName: fileName,
              mimeType: mimeType
            }],
            createdAt: new Date(),
            updatedAt: new Date()
          });

          await equipment.save();

          resolve({
            status: 200,
            success: true,
            message: 'Equipment created successfully with image',
            data: {
              equipmentNo: equipmentNoStr,
              equipmentName: equipment.equipmentName,
              totalImages: equipment.images.length,
              imagePath,
              imageLabel,
              fileName,
              isNewEquipment: true
            }
          });
        }

      } catch (error) {
        console.error('Error adding equipment image:', error);

        // Handle duplicate key error specifically
        if (error.code === 11000) {
          reject({
            status: 409,
            success: false,
            message: 'Equipment number already exists - there might be a race condition',
            error: 'Duplicate key error'
          });
        } else if (error.name === 'ValidationError') {
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
        const equipment = await stockHandoverModel.findOne({ equipmentNo: regNo });

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

  insertStocks: (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Validate required fields - ADD name to validation
        if (!data.product || !data.serialNumber || !data.type || !data.rate || !data.stockCount) {
          return reject({
            status: 400,
            message: 'Missing required fields: product, type, serialNumber, rate, and stockCount are required'
          });
        }

        // Validate type-specific fields
        if (data.type === 'equipment' && (!data.equipments)) {
          return reject({
            status: 400,
            message: 'Equipment number and name are required when type is equipment'
          });
        }

        // Check if serial number already exists
        const existingStock = await Stock.findOne({ serialNumber: data.serialNumber });
        if (existingStock) {
          return reject({
            status: 409,
            message: 'Stock with this serial number already exists'
          });
        }

        // Create new stock record - ADD name field
        const newStock = new Stock({
          type: data.type || 'stock',
          equipments: data.type === 'equipment' ? data.equipments : null,
          product: data.product,
          name: data.name, // ADD this line
          description: data.description, // Optional field
          serialNumber: data.serialNumber,
          date: data.date ? new Date(data.date) : new Date(),
          rate: parseFloat(data.rate),
          stockCount: parseInt(data.stockCount),
          // Optional fields with defaults
          unit: data.unit || 'pcs',
          minThreshold: data.minThreshold || 5,
          maxThreshold: data.maxThreshold || 100,
          category: data.category,
          subCategory: data.subCategory,
          location: data.location,
          warehouse: data.warehouse
        });

        const savedStock = await newStock.save();

        await createNotification({
          title: "New Stock Added",
          description: `${data.stockCount} new ${data.serialNumber} - ${data.product} added to stock ${newStock.equipments ? `for ${newStock.equipments}` : ''}`,
          priority: "high",
          type: 'normal'
        });

        await PushNotificationService.sendGeneralNotification(
          null, // broadcast to all users
          "New Stock Added", //title
          `${data.stockCount} new ${data.serialNumber} - ${data.product} added to stock ${newStock.equipments ? `for ${newStock.equipments}` : ''}`, //decription
          'high', //priority
          'normal' // type
        );

        resolve({
          status: 201,
          success: true,
          message: 'Stock added successfully',
          data: savedStock
        });

      } catch (error) {
        console.error('Error in insertStocks:', error);

        // Handle specific MongoDB errors
        if (error.code === 11000) {
          reject({
            status: 409,
            message: 'Duplicate serial number. Stock with this serial number already exists.'
          });
        } else if (error.name === 'ValidationError') {
          const validationErrors = Object.values(error.errors).map(err => err.message);
          reject({
            status: 400,
            message: `Validation error: ${validationErrors.join(', ')}`
          });
        } else {
          reject({
            status: 500,
            message: 'Internal server error while adding stock'
          });
        }
      }
    });
  },

  fetchStocks: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const stocks = await Stock.find({})
          .sort({ createdAt: -1 }) // Sort by newest first
          .lean(); // Use lean() for better performance when you don't need mongoose document methods

        resolve({
          status: 200,
          success: true,
          message: 'Stocks fetched successfully',
          data: stocks,
          count: stocks.length
        });

      } catch (error) {
        console.error('Error in fetchStocks:', error);
        reject({
          status: 500,
          message: 'Internal server error while fetching stocks'
        });
      }
    });
  },

  // Fetch stocks by type
  fetchStocksByType: (type) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (!['stock', 'equipment'].includes(type)) {
          return reject({
            status: 400,
            message: 'Invalid type. Must be either "stock" or "equipment"'
          });
        }

        const stocks = await Stock.findByType(type)
          .sort({ createdAt: -1 })
          .lean();

        resolve({
          status: 200,
          success: true,
          message: `${type} stocks fetched successfully`,
          data: stocks,
          count: stocks.length
        });

      } catch (error) {
        console.error('Error in fetchStocksByType:', error);
        reject({
          status: 500,
          message: 'Internal server error while fetching stocks by type'
        });
      }
    });
  },

  // Fetch stocks by equipment number
  fetchStocksByEquipment: (equipmentNumber) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (!equipmentNumber) {
          return reject({
            status: 400,
            message: 'Equipment number is required'
          });
        }

        const stocks = await Stock.findByEquipmentNumber(equipmentNumber)
          .sort({ createdAt: -1 })
          .lean();

        resolve({
          status: 200,
          success: true,
          message: 'Equipment stocks fetched successfully',
          data: stocks,
          count: stocks.length
        });

      } catch (error) {
        console.error('Error in fetchStocksByEquipment:', error);
        reject({
          status: 500,
          message: 'Internal server error while fetching equipment stocks'
        });
      }
    });
  },

  updateProduct: (stockId, updateData) => {

    return new Promise(async (resolve, reject) => {
      try {
        // Validate required stockId
        if (!stockId) {
          return reject({
            status: 400,
            message: 'Stock ID is required'
          });
        }

        // Find the current stock item
        const currentStock = await Stock.findById(stockId);
        if (!currentStock) {
          return reject({
            status: 404,
            message: 'Stock not found'
          });
        }

        // Update stock with movement tracking
        updatedStock = await Stock.findByIdAndUpdate(
          stockId,
          {
            product: updateData.product,
            equipments: updateData.equipments,
            stockCount: updateData.stockCount,
            updatedAt: new Date()
          },
          {
            new: true,
            runValidators: true
          }
        );


        resolve({
          status: 200,
          success: true,
          message: 'Stock updated successfully',
          data: updatedStock
        });

      } catch (error) {
        console.error('Error in updateStock:', error);

        // Handle different types of errors
        if (error.name === 'ValidationError') {
          const validationErrors = Object.values(error.errors).map(err => err.message);
          reject({
            status: 400,
            message: `Validation error: ${validationErrors.join(', ')}`
          });
        } else if (error.name === 'CastError') {
          reject({
            status: 400,
            message: 'Invalid stock ID format'
          });
        } else if (error.code === 11000) {
          reject({
            status: 400,
            message: 'Duplicate entry - this stock item already exists'
          });
        } else {
          reject({
            status: 500,
            message: 'Internal server error while updating stock'
          });
        }
      }
    });
  },

  // Update stock by ID
  updateStock: (stockId, updateData) => {

    return new Promise(async (resolve, reject) => {
      try {
        // Validate required stockId
        if (!stockId) {
          return reject({
            status: 400,
            message: 'Stock ID is required'
          });
        }

        // Find the current stock item
        const currentStock = await Stock.findById(stockId);
        if (!currentStock) {
          return reject({
            status: 404,
            message: 'Stock not found'
          });
        }

        let updatedStock;
        // Calculate the quantity change
        let quantityChange = 0;

        // Check if this is a movement-based update (stock quantity change with tracking)
        if (updateData.type && ['add', 'deduct', 'adjustment', 'initial'].includes(updateData.type)) {

          let newQuantity

          if (updateData.type === 'deduct') {
            newQuantity = currentStock.stockCount - updateData.stockCount;
          } else if (updateData.type === 'add') {
            newQuantity = updateData.stockCount + currentStock.stockCount;
          }

          if (updateData.type === 'add') {
            quantityChange = updateData.stockCount;
          } else if (updateData.type === 'deduct') {
            quantityChange = updateData.stockCount;
          } else if (updateData.type === 'adjustment') {
            quantityChange = Math.abs(updateData.stockCount - currentStock.stockCount);
          } else if (updateData.type === 'initial') {
            quantityChange = updateData.stockCount;
          }

          // Ensure quantity is positive for tracking
          quantityChange = Math.abs(quantityChange);

          // Prepare movement data for tracking
          const movementData = {
            date: updateData.date || new Date(),
            time: updateData.time || new Date().toLocaleTimeString(),
            type: updateData.type,
            quantity: quantityChange,
            previousQuantity: currentStock.stockCount,
            newQuantity: newQuantity,
            reason: updateData.reason || `Stock ${updateData.type}`,
            notes: updateData.notes || '',
            createdAt: new Date()
          };

          // Add equipment and mechanic tracking for deductions
          if (updateData.type === 'deduct') {

            if (!updateData.equipmentName || !updateData.mechanicName) {
              return reject({
                status: 400,
                message: 'Equipment name and Mechanic name are required for tracking'
              });
            }


            movementData.equipmentName = updateData.equipmentName;
            movementData.equipmentNumber = updateData.equipmentNumber;

            movementData.mechanicName = updateData.mechanicName;
            movementData.mechanicEmployeeId = 1;

          }

          // Add created by information if available
          if (updateData.createdBy) {
            movementData.createdBy = updateData.createdBy;
          }

          // Update stock with movement tracking
          updatedStock = await Stock.findByIdAndUpdate(
            stockId,
            {
              stockCount: newQuantity,
              $push: { movements: movementData },
              updatedAt: new Date()
            },
            {
              new: true,
              runValidators: true
            }
          );


        } else {
          // Remove movement-specific fields for regular updates
          const {
            type,
            equipmentId,
            equipmentName,
            equipmentNumber,
            mechanicId,
            mechanicName,
            mechanicEmployeeId,
            date,
            time,
            reason,
            notes,
            createdBy,
            ...regularUpdateData
          } = updateData;

          updatedStock = await Stock.findByIdAndUpdate(
            stockId,
            { ...regularUpdateData, updatedAt: new Date() },
            { new: true, runValidators: true }
          );

          await createNotification({
            title: "Stock Update",
            description: `${quantityChange} ${currentStock.product} with part number ${currentStock.serialNumber} is used by ${mechanicName} for ${equipmentName} ${equipmentNumber}`,
            priority: "high",
            type: 'normal'
          });

          await PushNotificationService.sendGeneralNotification(
            null, // broadcast to all users
            "Stock Update", //title
            `${quantityChange} ${currentStock.product} with part number ${currentStock.serialNumber} is used by ${mechanicName} for ${equipmentName} ${equipmentNumber}`, //decription
            'high', //priority
            'normal' // type
          );
        }

        // Check for low stock notification
        if (updatedStock.stockCount < 10) {
          let message = `Urgent Requirement : ${currentStock.product} with part number ${currentStock.serialNumber} is in low stock, only ${currentStock.stockCount} items left`
          if (updatedStock.stockCount == 0) {
            message = `Urgent Requirement : ${currentStock.product} with part number ${currentStock.serialNumber} is in out of stock`
          }

          try {
            // Send notification to special user 
            await userServices.pushSpecialNotification(
              process.env.JALEEL_KA,
              updatedStock.stockCount,
              stockId,
              message
            );
          } catch (notificationError) {
            console.error('Error sending low stock notification:', notificationError);
          }

          await PushNotificationService.sendGeneralNotification(
            null, // broadcast to all users
            "Low Stock", //title
            message,
            'high', //priority
            'normal' // type
          );
        } else {
          await createNotification({
            title: "Stock Update",
            description: `${quantityChange} ${currentStock.product} with part number ${currentStock.serialNumber} is used by ${updateData.mechanicName} for ${updateData.equipmentName} ${updateData.equipmentNumber}`,
            priority: "high",
            type: 'normal'
          });

          await PushNotificationService.sendGeneralNotification(
            null, // broadcast to all users
            "Stock Update", //title
            `${quantityChange} ${currentStock.product} with part number ${currentStock.serialNumber} is used by ${updateData.mechanicName} for ${updateData.equipmentName} ${updateData.equipmentNumber}`, //decription
            'high', //priority
            'normal' // type
          );
        }

        resolve({
          status: 200,
          success: true,
          message: 'Stock updated successfully',
          data: updatedStock
        });

      } catch (error) {
        console.error('Error in updateStock:', error);

        // Handle different types of errors
        if (error.name === 'ValidationError') {
          const validationErrors = Object.values(error.errors).map(err => err.message);
          reject({
            status: 400,
            message: `Validation error: ${validationErrors.join(', ')}`
          });
        } else if (error.name === 'CastError') {
          reject({
            status: 400,
            message: 'Invalid stock ID format'
          });
        } else if (error.code === 11000) {
          reject({
            status: 400,
            message: 'Duplicate entry - this stock item already exists'
          });
        } else {
          reject({
            status: 500,
            message: 'Internal server error while updating stock'
          });
        }
      }
    });
  },


  // Get all movements with stock information
  getMovementsWithStock: () => {
    return new Promise(async (resolve, reject) => {
      try {
        // Simple query to get all non-deleted stocks
        const stocks = await Stock.find({});

        let totalStocks = 0;
        let totalCost = 0;
        let totalQuantityUsed = 0;
        let stockSummary = [];
        let results = [];

        // Process each stock
        stocks.forEach(stock => {
          // Calculate stock statistics
          const currentStockCount = stock.stockCount || 0;
          const rate = stock.rate || 0;
          const stockValue = currentStockCount * rate;

          // Calculate total quantity used (deducted) from movements
          let quantityUsed = 0;
          let addedQuantity = 0;

          if (stock.movements && stock.movements.length > 0) {
            stock.movements.forEach(movement => {
              if (movement.type === 'deduct') {
                quantityUsed += movement.quantity || 0;
              } else if (movement.type === 'add') {
                addedQuantity += movement.quantity || 0;
              }
            });
          }

          // Add to totals
          totalStocks += currentStockCount;
          totalCost += stockValue;
          totalQuantityUsed += quantityUsed;

          // Add to stock summary
          stockSummary.push({
            stockId: stock._id,
            product: stock.product,
            name: stock.name,
            currentStockCount,
            rate,
            stockValue,
            quantityUsed,
            addedQuantity,
            totalMovements: stock.movements ? stock.movements.length : 0
          });

          // Process movements for detailed results (maintaining original structure)
          if (stock.movements && stock.movements.length > 0) {
            stock.movements.forEach(movement => {
              results.push({
                // Stock Information
                stockInfo: {
                  stockId: stock._id,
                  product: stock.product,
                  description: stock.description,
                  serialNumber: stock.serialNumber,
                  currentStockCount: stock.stockCount,
                  rate: stock.rate,
                  unit: stock.unit,
                  status: stock.status,
                  category: stock.category,
                  subCategory: stock.subCategory,
                  location: stock.location,
                  warehouse: stock.warehouse,
                  minThreshold: stock.minThreshold,
                  maxThreshold: stock.maxThreshold,
                  totalValue: stock.totalValue
                },
                // Movement Information
                movementInfo: {
                  movementId: movement._id,
                  date: movement.date,
                  time: movement.time,
                  type: movement.type,
                  quantity: movement.quantity,
                  previousQuantity: movement.previousQuantity,
                  newQuantity: movement.newQuantity,
                  reason: movement.reason,
                  notes: movement.notes,
                  createdAt: movement.createdAt
                },
                // Equipment Information (if applicable)
                equipmentInfo: movement.type === 'deduct' ? {
                  equipmentId: movement.equipmentId,
                  equipmentName: movement.equipmentName,
                  equipmentNumber: movement.equipmentNumber
                } : null,
                // Mechanic Information (if applicable)
                mechanicInfo: movement.type === 'deduct' ? {
                  mechanicId: movement.mechanicId,
                  mechanicName: movement.mechanicName,
                  mechanicEmployeeId: movement.mechanicEmployeeId
                } : null
              });
            });
          }
        });

        // Sort results by movement date (newest first)
        results.sort((a, b) => new Date(b.movementInfo.date) - new Date(a.movementInfo.date));

        resolve({
          status: 200,
          success: true,
          message: 'Movements with stock information retrieved successfully',
          data: results,
          count: results.length,
          // Additional statistics
          statistics: {
            totalStocks: totalStocks,
            totalCost: totalCost,
            totalQuantityUsed: totalQuantityUsed,
            totalStockItems: stocks.length,
            stockSummary: stockSummary
          }
        });

      } catch (error) {
        console.error('Error in getMovementsWithStock:', error);
        reject({
          status: 500,
          message: 'Error retrieving movements with stock information'
        });
      }
    });
  },

  getStockMovementsByEquipment: (equipmentId) => {
    return new Promise(async (resolve, reject) => {
      try {
        const movements = await Stock.getMovementsByEquipment(equipmentId);
        resolve({
          status: 200,
          success: true,
          data: movements
        });
      } catch (error) {
        console.error('Error getting movements by equipment:', error);
        reject({
          status: 500,
          message: 'Error retrieving stock movements for equipment'
        });
      }
    });
  },

  getStockMovementsByMechanic: (mechanicId) => {
    return new Promise(async (resolve, reject) => {
      try {
        const movements = await Stock.getMovementsByMechanic(mechanicId);
        resolve({
          status: 200,
          success: true,
          data: movements
        });
      } catch (error) {
        console.error('Error getting movements by mechanic:', error);
        reject({
          status: 500,
          message: 'Error retrieving stock movements for mechanic'
        });
      }
    });
  },

  getStockAccountabilityReport: (startDate, endDate) => {
    return new Promise(async (resolve, reject) => {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Set end date to end of day to include all records for that day
        end.setHours(23, 59, 59, 999);

        // Use aggregation pipeline for better performance
        const result = await Stock.aggregate([
          // Match stocks that are not deleted
          {
            $match: {
              isDeleted: { $ne: true }, // Handle both false and undefined
              movements: { $exists: true, $ne: [] } // Ensure movements array exists and is not empty
            }
          },
          // Unwind the movements array
          {
            $unwind: '$movements'
          },
          // Match only deduction movements within date range
          {
            $match: {
              'movements.type': 'deduct',
              'movements.date': {
                $gte: start,
                $lte: end
              }
            }
          },
          // Project the required fields
          {
            $project: {
              date: '$movements.date',
              time: '$movements.time',
              stockItem: '$product',
              product: '$product',
              serialNumber: '$serialNumber',
              quantityTaken: '$movements.quantity',
              rate: '$rate',
              totalValue: { $multiply: ['$movements.quantity', '$rate'] },
              mechanicName: { $ifNull: ['$movements.mechanicName', 'Unknown'] },
              mechanicId: '$movements.mechanicId',
              mechanicEmployeeId: { $ifNull: ['$movements.mechanicEmployeeId', 'Unknown'] },
              equipmentName: { $ifNull: ['$movements.equipmentName', 'Unknown'] },
              equipmentNumber: { $ifNull: ['$movements.equipmentNumber', 'Unknown'] },
              equipmentId: '$movements.equipmentId',
              reason: { $ifNull: ['$movements.reason', 'No reason provided'] },
              notes: { $ifNull: ['$movements.notes', ''] }
            }
          },
          // Sort by date (newest first)
          {
            $sort: { date: -1 }
          }
        ]);

        // Calculate summary
        const totalValue = result.reduce((sum, item) => sum + item.totalValue, 0);

        resolve({
          status: 200,
          success: true,
          data: result,
          summary: {
            totalTransactions: result.length,
            totalValue: totalValue,
            dateRange: { startDate, endDate }
          }
        });
      } catch (error) {
        console.error('Error generating accountability report:', error);
        reject({
          status: 500,
          message: 'Error generating stock accountability report'
        });
      }
    });
  },

  // Delete stock by ID
  deleteStock: (stockId) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (!stockId) {
          return reject({
            status: 400,
            message: 'Stock ID is required'
          });
        }

        const deletedStock = await Stock.findByIdAndDelete(stockId);

        if (!deletedStock) {
          return reject({
            status: 404,
            message: 'Stock not found'
          });
        }

        resolve({
          status: 200,
          success: true,
          message: 'Stock deleted successfully',
          data: deletedStock
        });

      } catch (error) {
        console.error('Error in deleteStock:', error);
        reject({
          status: 500,
          message: 'Internal server error while deleting stock'
        });
      }
    });
  }
};