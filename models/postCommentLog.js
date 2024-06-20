const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PostCommentLogSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    comment: { type: Schema.Types.ObjectId, ref: 'PostComment', default: null },
    parent: { type: Schema.Types.ObjectId, ref: 'PostComment', default: null },
    upvotes: {
      type: Number,
      default: 0,
    },
    downvotes: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: 0,
    },
    update_required: { type: Boolean, default: false },
    expires_at: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

PostCommentLogSchema.pre('save', function (next) {
  this.score = this.upvotes - this.downvotes;
  next();
});

PostCommentLogSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PostCommentLog', PostCommentLogSchema);
