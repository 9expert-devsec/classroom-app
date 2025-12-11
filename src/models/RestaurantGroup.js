import mongoose from "mongoose";

const RestaurantGroupSchema = new mongoose.Schema(
  {
    date: Date,
    restaurants: [
      {
        id: String,
        name: String,
        logo: String,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.RestaurantGroup ||
  mongoose.model("RestaurantGroup", RestaurantGroupSchema);
