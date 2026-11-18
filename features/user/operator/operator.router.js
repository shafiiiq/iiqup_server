const express = require('express')
const controller = require('./operator.controller')
const { paginationMiddleware } = require('#middlewares/pagination.middleware')
const mobilizationRouter = require('./mobilization/operator.mobilization.router')
const { authMiddleware } = require('#middlewares/jwt.middleware')

const router = express.Router()

router.get('/', paginationMiddleware, controller.getAllOperators)
router.post('/', controller.createOperator)
router.post('/profile', controller.uploadProfilePic)
router.get('/designations', controller.getDesignations)

router.use(
  ['/all-mobilizations', '/mobilization-history', '/mobilize-operator', '/demobilize-operator', '/replace-operator'],
  authMiddleware
)
router.use(mobilizationRouter)

router.get('/:qatarId', controller.getOperatorByQatarId)
router.put('/:id', controller.updateOperator)
router.delete('/:qatarId', controller.deleteOperator)

module.exports = router