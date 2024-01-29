const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    blogs: [{ type: Schema.Types.ObjectId, ref: 'Blog' }],
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

UserSchema.virtual('full_name').get(function () {
  return `${this.first_name} ${this.last_name}`;
});

module.exports = mongoose.model('User', UserSchema);
