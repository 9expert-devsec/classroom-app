import mongoose from "mongoose";

const BillCounterSchema = new mongoose.Schema(
  {
    // YYYY-MM-DD (Asia/Bangkok)
    dayYMD: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.models.BillCounter ||
  mongoose.model("BillCounter", BillCounterSchema);
