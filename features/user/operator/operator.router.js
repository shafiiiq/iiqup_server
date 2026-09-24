const express = require('express')
const controller = require('./operator.controller')
const { paginationMiddleware } = require('#middlewares/pagination.middleware')
const mobilizationRouter = require('./mobilization/operator.mobilization.router')

const router = express.Router()

router.get('/', paginationMiddleware, controller.getAllOperators)
router.post('/', controller.createOperator)
router.post('/profile', controller.uploadProfilePic)
router.get('/designations', controller.getDesignations)

router.use(mobilizationRouter)

router.get('/:qatarId', controller.getOperatorByQatarId)
router.put('/:qatarId', controller.updateOperator)
router.delete('/:qatarId', controller.deleteOperator)

module.exports = router