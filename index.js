const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

// const { createRemoteJWKSet, jwtVerify } = require('jose-cjs')

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const db = client.db("LifeAtlas");
    //Database collections

    const subscriptionsCollection = db.collection("subscriptions");
    const userCollection = db.collection("user");
    const lessonCOllection= db.collection("lessons")
    const savedLessonCollection=db.collection("savedLessons")
    const likedLessonCollection=db.collection("likedLessons")
    const commentCollection=db.collection("comment")
    const sessionCollection = db.collection('session');

//middleware

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

//  ---------------------------------

const verifyToken = async(req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access1" });
  }
  const token= authHeader.split(" ")[1]
  // console.log("Token", token)
  if(!token){
    return res.status(401).send({ message: "Unauthorized access2" });
  }
 try{
  //  const {payload} =await jwtVerify(token, JWKS)
  // req.user=payload;
  // console.log("payload", payload)

   const query = { token: token }
    const session = await sessionCollection.findOne(query);

    if (!session) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    const userId = session.userId;


    const userQuery = {
        _id: userId
    }

    const user = await userCollection.findOne(userQuery);
    // console.log("Verify user", user)
    if (!user) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    // set data in the req object
    req.user = user;

    next();
 }
 catch(err){
  // console.log(req.originalUrl)
  // console.log("error", err)
   return res.status(401).send({ message: "Unauthorized access3" });
 }
}
const verifyPremiumUser=async(req,res,next)=>{
  const user=req.user;
  
  // console.log("user verify:" , user);
  if(user.role!=="user" || user.plan!=="premium"){
    return res.status(403).send({message:"Forbidden"})
  }
  next()
}

async function run() {
  try {
    // await client.connect();
    

    //lessons-----------todo
        app.post('/lessons',verifyToken,verifyPremiumUser, async (req, res) => {  
    const lessonData = req.body;
    console.log(lessonData)
    const newLessonData={
      ...lessonData,
      createdAt:new Date(),
    }
    const result=await lessonCOllection.insertOne(newLessonData)
    res.send(result);
})

//eta sobai dekhte parbe. so don't need to verify
app.get("/lessons/all", async (req, res) => {
      const result = await lessonCOllection.find().sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    //etao sobai dekhte parbe, but ta ke login hote hobe----------todo
app.get("/lessons/:id", async (req, res) => {
      const {id} = req.params
      console.log(id)
      const query= {
        _id : new ObjectId(id)
      }
      const result = await lessonCOllection.findOne(query)
      res.send(result);
    });


    // saved lessons--------todo
    app.post("/savedlessons",verifyToken,async (req, res) => {  
    const savedLessonData = req.body;
   
    const alreadySaved = await savedLessonCollection.findOne({
      lessonId: savedLessonData.lessonId,
      userId: savedLessonData.userId
    });

   
    if (alreadySaved) {
      return res.status(400).send({ 
        success: false, 
        message: "You have already saved this lesson!" 
      });
    }
    const newSavedLessonData={
      ...savedLessonData,
      createdAt:new Date(),
    }
    const result=await savedLessonCollection.insertOne(newSavedLessonData)
    res.send(result);

    //update lesson for user saved it 
     const updateLesson = await lessonCOllection.updateOne(
      {
        _id: new ObjectId(savedLessonData.lessonId),
      },
      {
      $inc: { saveCount: 1 }
      }
    )
    // res.send(updateLesson);
    
})

// get favorite lessons from the saved lesson collection------todo
 app.get("/saved/lessons/favorite/:id",verifyToken, async (req, res) => {
      
    const {id} = req.params;
 const query = { userId: id };

    const result = await savedLessonCollection.find(query).toArray();

    res.send(result);
  } 
  );

//Liked Lessons
// ❤️ Liked Lessons Backend Route
app.post("/likedlessons", verifyToken, async (req, res) => {  
  try {
    const LikedLessonData = req.body;

    // ১. ইউজার ইতিমধ্যে লাইক করেছে কিনা চেক করা
    const alreadyLiked = await likedLessonCollection.findOne({
      lessonId: LikedLessonData.lessonId,
      userId: LikedLessonData.userId
    });

    if (alreadyLiked) {
      return res.status(400).send({ 
        success: false, 
        message: "You have already liked this lesson!" 
      });
    }

    // ২. নতুন লাইক ডেটা তৈরি ও ইনসার্ট করা
    const newLikedLessonData = {
      ...LikedLessonData,
      createdAt: new Date(),
    };
    
    const result = await likedLessonCollection.insertOne(newLikedLessonData);

  
    const updateLesson = await lessonCOllection.updateOne(
      {
        _id: new ObjectId(LikedLessonData.lessonId),
      },
      {
        $inc: { likeCount: 1 },
      }
    );

    return res.status(200).send({
      success: true,
      message: "Lesson liked successfully!",
      result,
      updateLesson,
    });

  } catch (error) {
    console.error("Backend Like Error:", error);
    return res.status(500).send({ 
      success: false, 
      message: "Internal server error while liking lesson." 
    });
  }
});
//Comment on the Lessons----todo
    app.post("/comment",verifyToken ,async (req, res) => {  
    const commentData = req.body;
    const newCommentLessonData={
      ...commentData,
      createdAt:new Date(),
    }
    const result=await commentCollection.insertOne(newCommentLessonData)
    res.send(result);

    const newCommentObj = {
      text: commentData.text,
      userId: commentData.userId,
      userName: commentData.userName,
      userImage: commentData.userImage,
      userRole: commentData.userRole,
      userPlan: commentData.userPlan,
      userEmail: commentData.userEmail,
      createdAt: new Date(),
    };

    //update lesson for user saved it 
     const updateLesson = await lessonCOllection.updateOne(
      {
        _id: new ObjectId(commentData.lessonId),
      },
      {
        // $push এর মাধ্যমে 'comments' নামের অ্যারে তৈরি হবে এবং তাতে ডাটা ঢুকবে
        $push: { comments: newCommentObj }, 
        
        // $inc এর মাধ্যমে 'commentCount' ফিল্ডটি না থাকলে তৈরি হবে এবং ১ করে বাড়বে
        $inc: { commentCount: 1 }          
      }
    )
  
    if (updateResult.modifiedCount > 0) {
      res.status(200).send({
        success: true,
        message: "Comment added to array successfully!",
        result: updateResult
      });
    } else {
      res.status(404).send({ success: false, message: "Lesson not found" });
    }
    // res.send(updateLesson);
})





    //user lessons
    app.get("/lessons/my/:creatorId", async (req, res) => {
      //  console.log( " request params: ",req.params)
  try {
    const creatorId = req.params.creatorId;
   

    const result = await lessonCOllection
      .find({ creatorId})
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch lessons" });
  }
});
//toggle visibility---------todo, ekhane verifyadmin add kora lagbe
app.patch("/lessons/visibility/:id",verifyToken, async (req, res) => {
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

app.patch("/lessons/access/:id",verifyToken,verifyPremiumUser, async (req, res) => {
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

app.delete("/lessons/:id",verifyToken, async (req, res) => {
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


//Specific lesson to update-----todo
app.get("/api/lessons/:id",verifyToken, async (req, res) => {
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

// UPDATE LESSON----todo
app.patch("/lessons/:id",verifyToken,verifyPremiumUser, async (req, res) => {
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

//todo
app.patch('/profile/:id',verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;

    const query = { _id: new ObjectId(id) };
    
    const updateDoc = {
      $set: { ...updateData } 
    };

    const result = await userCollection.updateOne(query, updateDoc);
    
    res.send({ success: true, message: "Profile updated!", result });

  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});


    //Subscription

 app.post("/subscription",verifyToken, async (req, res) => {
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
