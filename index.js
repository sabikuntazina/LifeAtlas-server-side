const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// const { createRemoteJWKSet, jwtVerify } = require('jose-cjs')

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//middleware

// const JWKS = createRemoteJWKSet(
//   new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
// );

//  ---------------------------------

// const verifyToken = async(req, res, next) => {
//   const authHeader = req?.headers.authorization;
//   if (!authHeader) {
//     return res.status(401).send({ message: "Unauthorized access1" });
//   }
//   const token= authHeader.split(" ")[1]
//   if(!token){
//     return res.status(401).send({ message: "Unauthorized access2" });
//   }
//  try{
//    const {payload} =await jwtVerify(token, JWKS)
//   console.log(payload)
//     next();
//  }
//  catch(err){
//    return res.status(401).send({ message: "Unauthorized access3" });
//  }
// }

async function run() {
  try {
    await client.connect();
    const db = client.db("LifeAtlas");
    //Database collections

    const subscriptionsCollection = db.collection("subscriptions");
    const userCollection = db.collection("user");
    const lessonCOllection= db.collection("lessons")

    //lessons
        app.post('/lessons',async (req, res) => {  
    const lessonData = req.body;
    const newLessonData={
      ...lessonData,
      createdAt:new Date(),
    }
    const result=await lessonCOllection.insertOne(newLessonData)
    res.send(result);
})

app.get("/lessons/all", async (req, res) => {
      const result = await lessonCOllection.find().toArray();
      res.send(result);
    });



    //user lessons

    app.get("/lessons/my/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const result = await lessonCOllection
      .find({ creatorId: userId })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch lessons" });
  }
});
//toggle visibility
app.patch("/lessons/visibility/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { visibility } = req.body;

    const result = await lessonCOllection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { visibility }
      }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Visibility update failed" });
  }
});

//--update accessability--------------

app.patch("/lessons/access/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { access, userPlan } = req.body;

    // optional safety check
    if (access === "premium" && userPlan !== "premium") {
      return res.status(403).send({
        error: "Only premium users can set premium access",
      });
    }

    const result = await lessonCOllection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { access }
      }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Access update failed" });
  }
});

//Delete lesson

app.delete("/lessons/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result = await lessonCOllection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Delete failed" });
  }
});

//UPDATE STATS (reactions / saves)
app.patch("/lessons/stats/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { type } = req.body; // "reaction" | "save"

    const field = type === "reaction" ? "reactions" : "saves";

    const result = await lessonCOllection.updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { [field]: 1 }
      }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Stats update failed" });
  }
});

//Specific lesson to update
app.get("/api/lessons/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const lesson = await lessonCOllection.findOne({
      _id: new ObjectId(id)
    });
    res.send(lesson);
  } catch (err) {
    res.status(500).send({
      success: false,
      message: "Failed to fetch lesson",
      error: err.message,
    });
  }
});

// UPDATE LESSON
app.patch("/lessons/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const {
      title,
      description,
      category,
      tone,
      image,
      access,
    } = req.body;

    const result = await lessonCOllection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          title,
          description,
          category,
          tone,
          image,
          access,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Lesson not found",
      });
    }

    res.send({
      success: true,
      message: "Lesson updated successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      message: "Update failed",
      error: err.message,
    });
  }
});


    //Subscription

 app.post("/subscription", async (req, res) => {
  try {
    console.log("API HIT");
    console.log("BODY:", req.body);

    const data = req.body;

    const result = await subscriptionsCollection.insertOne({
      ...data,
      createdAt: new Date(),
    });

    console.log("INSERT RESULT:", result);

    const updateResult = await userCollection.updateOne(
      {
        _id: new ObjectId(data.userId),
      },
      {
        $set: {
          plan: "premium",
        },
      }
    );

    console.log("UPDATE RESULT:", updateResult);

    return res.send({
      success: true,
      subscriptionResult: result,
      updateResult,
    });
  } catch (error) {
    console.log("ERROR:", error);

    return res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //  await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Simple CRUD server is serving...");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
