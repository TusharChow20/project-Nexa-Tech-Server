require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = 4000 || process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); // Added ObjectId
const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    db = client.db("productHandle");

    // GET all products
    app.get("/api/products", async (req, res) => {
      try {
        const products = await db.collection("addProducts").find({}).toArray();
        res.json(products);
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Failed to fetch products" });
      }
    });

    // GET single product by ID
    app.get("/api/products/:id", async (req, res) => {
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
    app.post("/api/products", async (req, res) => {
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
          userEmail, // Store the user's email
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
    app.put("/api/products/:id", async (req, res) => {
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

        // Prepare update data (don't allow userEmail to be changed)
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
          .updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updateData }
          );

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
    app.delete("/api/products/:id", async (req, res) => {
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

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
