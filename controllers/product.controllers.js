// const productService = require('../services/product-service');
// const userService = require('../services/service-report');
// const addProducts = async (req, res) => {
//   try {
//     const addProduct = await productService.insertProduct(req.body)
//     res.status(addProduct.status).json(addProduct)
//   } catch (err) {
//     res.json({
//       error: err.message
//     })
//   }
// }
// const getProducts = async (req, res) => {
//   try {
//     const getproducts = await productService.fetchProducts();
//     res.status(getproducts.status).json(getproducts);
//   } catch (err) {
//     res.status(err.status || 500).json({ message: 'Cannot get all products', error: err.message });
//   }
// }

// const addTocart = async (req, res) => {
//   try {
//     const addedproduct = await productService.insertToCart(req.body)
//     res.status(addedproduct.status).json(addedproduct)
//   } catch (err) {
//     res.status(err.status || 500).json({ message: 'unable to add cart' })
//   }
// }

// const getCart = async (req, res) => {
//   try {
//     const cartResponse = await productService.fetchCart(req.body.userId);
//     res.status(cartResponse.status).json(cartResponse);
//   } catch (err) {
//     res.status(err.status || 500).json({
//       message: err.message || 'Unable to fetch cart',
//     });
//   }
// };



// module.exports = {
//   addProducts, getProducts, addTocart, getCart
// } 