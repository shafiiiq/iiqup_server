const toolkitServices = require('../services/toolkit-services.js');

const addToolKits = async (req, res) => {
  toolkitServices.insertToolkit(req.body)
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

const getToolKits = async (req, res) => {
  toolkitServices.fetchToolkits()
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all toolkits', error: err.message });
    });
};

const updatetoolKits = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  toolkitServices.updateToolkit(id, updateData)
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

const deletetoolKits = async (req, res) => {
  const { id } = req.params;

  toolkitServices.deleteToolkit(id)
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

const updateVariant = async (req, res) => {
  const { toolkitId, variantId } = req.params;
  const updateData = req.body;

  toolkitServices.updateVariant(toolkitId, variantId, updateData)
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

const deleteVariant = async (req, res) => {
  const { toolkitId, variantId } = req.params;

  toolkitServices.deleteVariant(toolkitId, variantId)
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

const searchToolkits = async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  toolkitServices.searchToolkits(q)
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

const reduceStock = async (req, res) => {
  const { toolkitId, variantId } = req.params;
  const { quantity, reason, updatedBy, person } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid quantity is required'
    });
  }

  toolkitServices.reduceStock(toolkitId, variantId, quantity, reason, updatedBy, person)
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

const getStockHistory = async (req, res) => {
  const { toolkitId, variantId } = req.params;

  toolkitServices.getStockHistory(toolkitId, variantId)
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

const getToolkitStockHistory = async (req, res) => {
  const { toolkitId } = req.params;

  toolkitServices.getToolkitStockHistory(toolkitId)
    .then((result) => {
      if (result) {
        res.status(result.status).json(result);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

module.exports = {
  addToolKits,
  getToolKits,
  updatetoolKits,
  deletetoolKits,
  updateVariant,
  deleteVariant,
  searchToolkits,
  reduceStock,
  getStockHistory,
  getToolkitStockHistory
};