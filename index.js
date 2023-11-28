const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_user}:${process.env.DB_PASSWORD}@cluster0.2zvoo0z.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});






async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();



    const postCollection = client.db("forumFiesta").collection("posts");
    const tagCollection = client.db("forumFiesta").collection("tags")
    const userCollection = client.db("forumFiestaUsers").collection("users")
    const commentCollection = client.db("forumFiesta").collection("comments")



    //post related
    app.get('/posts', async (req, res) => {
      const result = await postCollection.find().toArray();
      res.send(result)
    })

    app.post('/ad-post', async (req, res) => {
      const post = req.body
      const result = await postCollection.insertOne(post)
      res.send(result);
    })

    app.get('/posts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await postCollection.findOne(query)
      res.send(result);
    });



    app.patch('/posts/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedSubmitted = req.body;
      console.log("upvotes", updatedSubmitted);

      const updateDoc = {
        $set: {
          'votesCount.upvotes': updatedSubmitted.upvotes,
          'votesCount.downvotes': updatedSubmitted.downvotes
        },
      };
      const result = await postCollection.updateOne(filter, updateDoc);
      res.send(result)
    })


    app.get('/my-posts', async (req, res) => {
      let query = {}

      if (req.query?.email) {
        query = {
          'author.email': req.query.email,
        }
        const result = await postCollection.find(query).toArray();
        res.send(result)
      }

    })

    app.delete('/posts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await postCollection.deleteOne(query);
      res.send(result)
    })


    // tags

    app.get('/tags', async (req, res) => {
      const result = await tagCollection.find().toArray();
      res.send(result)
    })



    // user related
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { userEmail: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exist', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userMail: email }
      const result = await userCollection.findOne(query)
      res.send(result)
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          userRole: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })




    // comments related
    app.post('/comments', async (req, res) => {
      const comment = req.body;
      const result = await commentCollection.insertOne(comment)
      res.send(result)
    })

    app.get('/comments', async (req, res) => {
      let query = {}

      if (req.query?.postId) {
        query = {
          'postInfo': req.query.postId,
        }
        const result = await commentCollection.find(query).toArray();
        res.send(result)
      }

    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}




run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Forum fiesta server')
})

app.listen(port, () => {
  console.log(`forum fiesta running on ${port}`)
})

