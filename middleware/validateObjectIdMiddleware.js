const { ObjectId } = require('mongoose').Types;

const validateObjectIdMiddleware = (idParam, model) => (req, res, next) => {
  const id = req.params[idParam];

  if (!ObjectId.isValid(id)) {
    return res.status(404).json({
      status: 'fail',
      message: `${model} not found`,
    });
  }

  next();
};

module.exports = validateObjectIdMiddleware;
