const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const BlogSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    posts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

module.exports = mongoose.model('Blog', BlogSchema);
