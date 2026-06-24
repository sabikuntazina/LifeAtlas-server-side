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
    const lessonCollection= db.collection("lessons")
    const savedLessonCollection=db.collection("savedLessons")
    const likedLessonCollection=db.collection("likedLessons")
    const commentCollection=db.collection("comment")
    const sessionCollection = db.collection('session');
    const featuredLessonCollection=db.collection("featuredLesson")
    const reportLessonCollection=db.collection("reportLesson")
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
const verifyAdmin=async(req,res,next)=>{
  const user=req.user;
  
  if(user.role!=="admin"){
    return res.status(403).send({message:"Forbidden"})
  }
  next()
}

async function run() {
  try {
    // await client.connect();
    

    //lessons------
        app.post('/lessons',verifyToken, async (req, res) => {  
    const lessonData = req.body;
    console.log(lessonData)
    const newLessonData={
      ...lessonData,
      createdAt:new Date(),
    }
    const result=await lessonCollection.insertOne(newLessonData)
    res.send(result);
      //update lesson for user saved it 
     const updateUser = await userCollection.updateOne(
      {
        _id: new ObjectId(lessonData.creatorId),
      },
      {
      $inc: { totalLesson: 1 }
      }
    )
})

//eta sobai dekhte parbe. so don't need to verify || Pagination added
app.get("/lessons/all", async (req, res) => {
  try {
    const { page = 1, limit = 9, search = "", category = "", tone = "", sortBy = "newest" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

 
    let query = {};


    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

 
    if (category) {
      query.category = category;
    }

   
    if (tone) {
      query.tone = tone;
    }

    let sortOptions = { createdAt: -1 }; 
    if (sortBy === "mostSaved") {
      sortOptions = { saveCount: -1 };
    }

   
    const totalData = await lessonCollection.countDocuments(query);
    const totalPage = Math.ceil(totalData / Number(limit));

    
    const result = await lessonCollection
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    res.send({ data: result, page: Number(page), totalPage });
  } catch (err) {
    console.error("Error fetching all lessons:", err);
    res.status(500).send({ error: "Server error occurred" });
  }
});

    // 🎯 Top contributors API End-point

app.get('/api/lessons/top-contributors', async (req, res) => {
  try {

    const topContributors = await lessonCollection.aggregate([

      {
        $match: {
          creatorId: { $exists: true, $ne: null, $ne: "" },
          creatorName: { $exists: true, $ne: null, $ne: "" }
        }
      },

      {
        $group: {
          _id: "$creatorId",
          name: { $first: "$creatorName" },
          image: { $first: "$creatorImg" },
          role: { $first: "$creatorRole" },
          email: { $first: "$creatorEmail" },
          totalLessons: { $sum: 1 }
        }
      },

      {
        $sort: { totalLessons: -1 }
      },

      {
        $limit: 5
      },
  
      {
        $project: {
          _id: 0,
          creatorId: "$_id", 
          name: { $ifNull: ["$name", "Anonymous Mind"] },
          role: { $ifNull: ["$role", "Contributor"] },
          email: { $ifNull: ["$email", "N/A"] },
          image: { $ifNull: ["$image", ""] },
          totalLessons: 1
        }
      }
    ]).toArray();

    // console.log("🚀 Leaderboard Computed successfully:", topContributors);

    res.status(200).json({
      success: true,
      data: topContributors
    });

  } catch (error) {
    console.error("❌ Leaderboard MongoDB Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch lesson", 
      error: error.message 
    });
  }
});

//
app.get("/lessons/most-saved", async (req, res) => {

    const topSavedLessons = await lessonCollection.find({ visibility: "public" }).sort({ saveCount: -1 }).limit(5).toArray();

    res.send(topSavedLessons);
 
});


    //etao sobai dekhte parbe, but ta ke login hote hobe--
app.get("/lessons/:id", async (req, res) => {
      const {id} = req.params
      console.log(id)
      const query= {
        _id : new ObjectId(id)
      }
      const result = await lessonCollection.findOne(query)
      res.send(result);
    });


    // saved lessons---
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
     const updateLesson = await lessonCollection.updateOne(
      {
        _id: new ObjectId(savedLessonData.lessonId),
      },
      {
      $inc: { saveCount: 1 }
      }
    )
    // res.send(updateLesson);
    
})

// get favorite lessons from the saved lesson collection----
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

  
    const updateLesson = await lessonCollection.updateOne(
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
     const updateLesson = await lessonCollection.updateOne(
      {
        _id: new ObjectId(commentData.lessonId),
      },
      {
       
        $push: { comments: newCommentObj }, 
        
       
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

        const {page=1,limit=9}=req.query;
  const skip= (Number(page)-1) * Number(limit);
  const totalData= await lessonCollection.countDocuments({creatorId});
  const totalPage=Math.ceil(totalData/Number(limit))
   

    const result = await lessonCollection.find({ creatorId}).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).toArray();

    res.send({data:result,page:Number(page),totalPage})
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch lessons" });
  }
});
//     app.get("/lessons/my/profile/:creatorId", async (req, res) => {
//       //  console.log( " request params: ",req.params)
//     const creatorId = req.params.creatorId;
//     const result = await lessonCollection.find({ creatorId}).sort({ createdAt: -1 }).toArray();

//     res.send(result)

// });

app.get("/lessons/creator/:creatorId", async (req, res) => {
  try {
    const creatorId = req.params.creatorId;
    const result = await lessonCollection.find({ creatorId }).sort({ createdAt: -1 }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch creator lessons" });
  }
});

app.get("/users/creator-info/:creatorId", async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const creatorId = req.params.creatorId;
    
  
    const result = await userCollection.findOne({ _id: new ObjectId(creatorId) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch creator bio" });
  }
});

//toggle visibility---------, ekhane verifyadmin add kora lagbe
app.patch("/lessons/visibility/:id",verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const { visibility } = req.body;

    const result = await lessonCollection.updateOne(
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

    const result = await lessonCollection.updateOne(
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

// app.delete("/lessons/:id",verifyToken, async (req, res) => {
//   try {
//     const id = req.params.id;

//     const result = await lessonCollection.deleteOne({
//       _id: new ObjectId(id),
//     });

//     res.send(result);
//   } catch (err) {
//     res.status(500).send({ error: "Delete failed" });
//   }

// });
app.delete("/lessons/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

   
    const result = await lessonCollection.deleteOne(query);

    if (result.deletedCount > 0 || result.acknowledged) {
      await featuredLessonCollection.deleteOne({
        $or: [
          { _id: new ObjectId(id) }, 
          { lessonId: id },          
          { lessonId: new ObjectId(id) } 
        ]
      });
    }

    if (result.deletedCount === 0) {
      return res.status(404).send({ success: false, message: "Lesson not found" });
    }

    res.send({ success: true, ...result });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).send({ success: false, error: "Delete failed" });
  }
});


//Specific lesson to update-----todo
app.get("/api/lessons/:id",verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    const lesson = await lessonCollection.findOne({
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
app.patch("/lessons/:id",verifyToken, async (req, res) => {
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

    const result = await lessonCollection.updateOne(
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


//admin related code here........
//get all users information
app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
    const users = await userCollection.find().sort({ createdAt: -1 }).toArray();

    const usersWithLessonCount = await Promise.all(
      users.map(async (user) => {
        const targetId = user.id || user._id.toString();
        const count = await lessonCollection.countDocuments({ creatorId: targetId });
        return {
          ...user,
          totalLessons: count,
        };
      })
    );

    res.send(usersWithLessonCount);
});


//update user Information

app.patch('/users/update/:id',verifyToken, verifyAdmin, async (req, res) => {
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

//------------------
//featured function
//----------------
//post featured lessons

app.post("/featured/lessons",verifyToken,verifyAdmin, async (req, res) => {
  const lesson = req.body;
  const lessonId = lesson._id;
  
  
  const exists = await featuredLessonCollection.findOne({ _id: new ObjectId(lessonId) });

  if (exists) {

    await featuredLessonCollection.deleteOne({ _id: new ObjectId(lessonId) });
    

    await lessonCollection.updateOne(
      { _id: new ObjectId(lessonId) },
      { $set: { isFeatured: false } }
    );
    
    return res.send({ message: "Removed", isFeatured: false });
  } else {
   
    await featuredLessonCollection.insertOne({ ...lesson, _id: new ObjectId(lessonId), isFeatured: true });
    
    await lessonCollection.updateOne(
      { _id: new ObjectId(lessonId) },
      { $set: { isFeatured: true } }
    );
    
    return res.send({ message: "Added", isFeatured: true });
  }
});

//get featured lessons---eta sobai dekhte parbe
app.get("/featured/lessons", async (req, res) => {
      const result = await featuredLessonCollection.find().limit(4).sort({ createdAt: -1 }).toArray();
      res.send(result);
    });



// Post report Lesson
app.post('/report/lesson',verifyToken, async (req, res) => {  
  try {
    const lessonData = req.body;
    
    if (!lessonData._id) {
      return res.status(400).send({ success: false, message: "Lesson ID is required" });
    }

    const lessonIdStr = lessonData._id;

    const reportResult = await reportLessonCollection.updateOne(
      { lessonId: lessonIdStr }, 
      {
        $setOnInsert: {
          title: lessonData.title,
          description: lessonData.description,
          category: lessonData.category,
          access:lessonData.access,
          creatorName: lessonData.creatorName,
          creatorId:lessonData.creatorId,
          creatorPlan:lessonData.creatorPlan,
          saveCount:lessonData.saveCount,
          creatorId: lessonData.creatorId,
          createdAt: new Date(),
        },
        $inc: { reportCount: 1 }, // যতবার রিপোর্ট হবে এই কাউন্ট ১ করে বাড়বে
        $set: { updatedAt: new Date() } // সর্বশেষ রিপোর্টের সময় ট্র্যাক রাখার জন্য
      },
      { upsert: true } // ম্যাচ না করলে নতুন ডকুমেন্ট বানাবে, ম্যাচ করলে আপডেট করবে
    );

    // ২. মূল lessonCollection-এ রিপোর্টের মেইন কাউন্ট ১ বাড়িয়ে দেওয়া
    const updateLesson = await lessonCollection.updateOne(
      { _id: new ObjectId(lessonIdStr) },
      { $inc: { report: 1 } }
    );

    // ফ্রন্টএন্ডে সাকসেস রেসপন্স পাঠানো
    res.send({ 
      success: true, 
      message: "Report processed successfully", 
      reportResult, 
      updateLesson 
    });

  } catch (error) {
    console.error("Report Lesson Error:", error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
});

//get reported lessons
app.get("/report/lesson",verifyToken,verifyAdmin, async (req, res) => {
      const result = await reportLessonCollection.find().sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

// Delete report Permanently
app.delete("/report/lessons/delete/permanently/:id",verifyToken, verifyAdmin,async (req, res) => {
  try {
    const id = req.params.id;
    
    const query = { _id: new ObjectId(id) };
    const result = await lessonCollection.deleteOne(query);

    if (result.deletedCount > 0) {
      
      await featuredLessonCollection.deleteOne({
        $or: [
          { _id: new ObjectId(id) }, 
          { lessonId: id },          
          { lessonId: new ObjectId(id) } 
        ]
      });

 
      await reportLessonCollection.deleteOne({
        $or: [
          { lessonId: id },
          { lessonId: new ObjectId(id) }
        ]
      });
      
      return res.send({ success: true, message: "Lesson and all associated reports deleted permanently", ...result });
    }

   
    return res.status(404).send({ success: false, message: "Lesson not found or already deleted" });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).send({ success: false, error: "Delete failed due to server error" });
  }
});

// Delete report from the reported lesson collection to ignore
app.delete('/report/lessons/delete/ignore/:id',verifyToken,verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;

   
    const result = await reportLessonCollection.deleteMany({
      $or: [
        { lessonId: id },
        { lessonId: new ObjectId(id) },
        { _id: new ObjectId(id) } 
      ]
    });

    if (result.deletedCount > 0) {
      res.send({ success: true, ...result });
    } else {
      res.status(404).send({ success: false, message: "No reports found to clear for this ID" });
    }

  } catch (err) {
    console.error("Ignore Report Error:", err);
    res.status(500).send({ success: false, error: "Failed to dismiss reports" });
  }
});


//dashboard er jonno information neyar jonno

app.get("/api/admin/dashboard-summary",verifyToken,verifyAdmin, async (req, res) => {
  let totalLessons = 0;
  let totalSaved = 0;
  let recentLessons = [];
  let chartData = [];

  const daysOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  chartData = daysOrder.map(day => ({ name: day, contributions: 0 }));


  try {
    totalLessons = await lessonCollection.countDocuments({});
  } catch (e) {
    console.error("❌ Error in lessonCollection.countDocuments:", e.message);
  }

 
  try {
    totalSaved = await savedLessonCollection.countDocuments({});
  } catch (e) {
    console.error("❌ Error in savedLessonCollection.countDocuments:", e.message);
  }


  try {
    recentLessons = await lessonCollection.find({})
      .sort({ _id: -1 }) 
      .limit(3)
      .project({ _id: 1, title: 1, category: 1, createdAt: 1 }) 
      .toArray();
  } catch (e) {
    console.error("❌ Error in recentLessons query:", e.message);
  }


  try {
    const rawChartData = await lessonCollection.aggregate([
      { 
        $match: { createdAt: { $exists: true, $ne: null } } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { 
              format: "%u", 
              date: { $toDate: "$createdAt" },
              timezone: "Asia/Dhaka" 
            } 
          }, 
          contributions: { $sum: 1 }
        }
      }
    ]).toArray();

    const dayMapping = {
      "1": "Mon",
      "2": "Tue",
      "3": "Wed",
      "4": "Thu",
      "5": "Fri",
      "6": "Sat",
      "7": "Sun"
    };

    if (rawChartData && rawChartData.length > 0) {
      chartData = daysOrder.map(day => {

        const found = rawChartData.find(item => dayMapping[item._id] === day);
        return {
          name: day,
          contributions: found ? found.contributions : 0 
        };
      });
    }
  } catch (e) {
    console.error("❌ Error in Chart Aggregation Pipeline:", e.message);
  }
  res.send({
    success: true,
    totalLessons,
    totalSaved,
    recentLessons,
    chartData
  });
});


//User Dashboard
app.get('/api/user/dashboard-summary',verifyToken, async (req, res) => {
  try {
    const { userId, email } = req.query; 
    
    if (!userId && !email) {
      return res.status(400).json({ 
        success: false, 
        message: "User identity (userId or email) is required." 
      });
    }

    const queryCondition = userId ? { creatorId: userId } : { creatorEmail: email };
    const savedCondition = userId ? { userId: userId } : { userEmail: email };

    const totalCreated = await lessonCollection.countDocuments(queryCondition);

    let totalSaved = 0;
    if (global.savedCollection) {
      totalSaved = await savedCollection.countDocuments(savedCondition);
    } else {
   
      totalSaved = await lessonCollection.countDocuments({ 
        savedBy: userId ? userId : email 
      });
    }

    const recentContributions = await lessonCollection
      .find(queryCondition)
      .sort({ createdAt: -1 }) 
      .limit(3) 
      .toArray();


    const daysOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let chartData = daysOrder.map(day => ({ name: day, contributions: 0 }));

    const dayMapping = {
      "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat", "7": "Sun"
    };

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rawChartData = await lessonCollection.aggregate([
      { 
        $match: { 
          ...queryCondition, 
          createdAt: { $gte: sevenDaysAgo, $exists: true, $ne: null } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { 
              format: "%u", 
              date: { $toDate: "$createdAt" },
              timezone: "Asia/Dhaka" 
            } 
          }, 
          contributions: { $sum: 1 }
        }
      }
    ]).toArray();

    if (rawChartData && rawChartData.length > 0) {
      chartData = daysOrder.map(day => {
        const found = rawChartData.find(item => dayMapping[item._id] === day);
        return {
          name: day,
          contributions: found ? found.contributions : 0 
        };
      });
    }

    res.status(200).json({
      success: true,
      totalCreated,
      totalSaved,
      recentContributions,
      chartData
    });

  } catch (error) {
    console.error("❌ Error in User Dashboard API:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error in synchronization layer.",
      error: error.message 
    });
  }
});





    // await client.db("admin").command({ ping: 1 });
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
