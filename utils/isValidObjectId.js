const mongoose = require('mongoose');

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

module.exports = isValidObjectId;
