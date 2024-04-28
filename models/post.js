const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema(
  {
    title: { type: String, default: '' },
    subheading: { type: String, default: '' },
    content: { type: String, default: '' },
    cover_image: { type: String, default: null },
    blog: {
      type: Schema.Types.ObjectId,
      ref: 'Blog',
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    published: { type: Boolean, default: false },
    published_at: { type: Date, default: null },
    trashed_at: { type: Date, default: null },
    content_updated_at: { type: Date, default: null },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

module.exports = mongoose.model('Post', PostSchema);
