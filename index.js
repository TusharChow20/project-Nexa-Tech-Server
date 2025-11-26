require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = 4000 || process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGO_URI;

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
let isConnected = false;

// Connection function
async function connectToDatabase() {
  if (isConnected) {
    return db;
  }

  try {
    await client.connect();
    db = client.db("productHandle");
    isConnected = true;
    console.log("Successfully connected to MongoDB!");
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

// Middleware to ensure DB connection
async function ensureDbConnection(req, res, next) {
  try {
    if (!isConnected) {
      await connectToDatabase();
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Database connection failed" });
  }
}

// Root route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// GET all products
app.get("/api/products", ensureDbConnection, async (req, res) => {
  try {
    const products = await db.collection("addProducts").find({}).toArray();
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET single product by ID
app.get("/api/products/:id", ensureDbConnection, async (req, res) => {
  try {
    const product = await db.collection("addProducts").findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// POST - Add new product (with user email)
app.post("/api/products", ensureDbConnection, async (req, res) => {
  try {
    const { title, image, description, price, userEmail, meta } = req.body;

    // Validation
    if (!title || !image || !description || !price) {
      return res.status(400).json({
        error: "Missing required fields: title, image, description, price",
      });
    }

    if (!userEmail) {
      return res.status(400).json({
        error: "User email is required",
      });
    }

    // Create product object with user email
    const newProduct = {
      title,
      image,
      description,
      price: parseFloat(price),
      userEmail,
      meta: {
        date: meta?.date || new Date().toISOString().split("T")[0],
        priority: meta?.priority || "medium",
      },
      createdAt: new Date(),
    };

    // Insert into database
    const result = await db.collection("addProducts").insertOne(newProduct);

    // Return the created product with its new _id
    const createdProduct = {
      _id: result.insertedId,
      ...newProduct,
    };

    res.status(201).json({
      message: "Product added successfully",
      product: createdProduct,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Failed to add product" });
  }
});

// PUT - Update product (only if userEmail matches)
app.put("/api/products/:id", ensureDbConnection, async (req, res) => {
  try {
    const { title, image, description, price, meta, userEmail } = req.body;

    // Check if userEmail is provided
    if (!userEmail) {
      return res.status(401).json({
        error: "User email is required for authorization",
      });
    }

    // First, find the product to check ownership
    const existingProduct = await db.collection("addProducts").findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if the user email matches the product owner
    if (existingProduct.userEmail !== userEmail) {
      return res.status(403).json({
        error: "Unauthorized: You can only update your own products",
      });
    }

    // Prepare update data
    const updateData = {
      ...(title && { title }),
      ...(image && { image }),
      ...(description && { description }),
      ...(price && { price: parseFloat(price) }),
      ...(meta && { meta }),
      updatedAt: new Date(),
    };

    // Update the product
    const result = await db
      .collection("addProducts")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

    res.json({
      message: "Product updated successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE product (only if userEmail matches)
app.delete("/api/products/:id", ensureDbConnection, async (req, res) => {
  try {
    const { userEmail } = req.body;

    // Check if userEmail is provided
    if (!userEmail) {
      return res.status(401).json({
        error: "User email is required for authorization",
      });
    }

    // First, find the product to check ownership
    const existingProduct = await db.collection("addProducts").findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if the user email matches the product owner
    if (existingProduct.userEmail !== userEmail) {
      return res.status(403).json({
        error: "Unauthorized: You can only delete your own products",
      });
    }

    // Delete the product
    const result = await db.collection("addProducts").deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.json({
      message: "Product deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// For local development
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

// Export for Vercel
module.exports = app;
