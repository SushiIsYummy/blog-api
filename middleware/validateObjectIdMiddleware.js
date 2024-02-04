const { ObjectId } = require('mongoose').Types;

const validateObjectIdMiddleware = (idParam, modelName) => (req, res, next) => {
  const id = req.params[idParam];

  if (!ObjectId.isValid(id)) {
    return res.status(404).json({
      status: 'fail',
      message: `${modelName} not found`,
    });
  }

  return next();
};

module.exports = validateObjectIdMiddleware;
