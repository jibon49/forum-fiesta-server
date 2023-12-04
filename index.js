const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.2zvoo0z.mongodb.net/?retryWrites=true&w=majority`;

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
    // await client.connect();



    const postCollection = client.db("forumFiesta").collection("posts");
    const tagCollection = client.db("forumFiesta").collection("tags")
    const userCollection = client.db("forumFiestaUsers").collection("users")
    const commentCollection = client.db("forumFiesta").collection("comments")
    const announcementCollection = client.db("forumFiesta").collection("announcement")
    const reportedCommentCollection = client.db("forumFiesta").collection("reported")


    //JWT related

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '2h'
      });
      res.send({ token });
    })



    //middlewares
    const verifyToken = (req, res, next) => {

      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
      })
    }


    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { userMail: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.userRole === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }


    //post related
    app.get('/posts', async (req, res) => {
      const result = await postCollection.find().toArray();
      res.send(result)
    })

    

    app.get('/posts/sort', async (req, res) => {

      try {
        const result = await postCollection.aggregate([
          {
            $addFields: {
              voteDifference: { $subtract: ['$votesCount.upvotes', '$votesCount.downvotes'] }
            }
          },
          {
            $sort: { voteDifference: -1 }
          }
        ]).toArray();

        res.send(result);
      } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).send('Internal Server Error');
      }

    });

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

    app.get('/my-posts/count', async (req, res) => {
      let query = {}

      if (req.query?.email) {
        query = {
          'author.email': req.query.email,
        }
        const result = await postCollection.find(query).toArray();
        const postCount = result.length;
        res.send({ postCount });
      }
    });


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

    app.post('/tags', async(req,res)=>{
      const tag = req.body;
      const result = await tagCollection.insertOne(tag)
      res.send(result)
    })



    // user related
    app.get('/users', verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { userMail: user.userMail }
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

    app.get('/users/membership/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userMail: email };
      const user = await userCollection.findOne(query);

      if (user) {
        const membership = user.membership;
        res.send({ membership });
      } else {
        res.status(404).send({ error: 'User not found' });
      }
    });


    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Unauthorized access' })
      }
      const query = { userMail: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.userRole === 'admin';
      }
      res.send({ admin });
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

    app.get('/allComments', async (req, res) => {
      const result = await commentCollection.find().toArray()
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

    app.post('/comments/reported/:id', async (req, res) => {
      const report = req.body;
      const result = await reportedCommentCollection.insertOne(report)
      res.send(result)
    })

    app.get('/comments/reported', async (req, res) => {
      const result = await reportedCommentCollection.find().toArray()
      res.send(result)
    })


    app.delete('/comments/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { _id: new ObjectId(id) }
      const result = await commentCollection.deleteOne(query);
      res.send(result)
    })


    app.delete('/comments/reported/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { _id: new ObjectId(id) }
      const result = await reportedCommentCollection.deleteOne(query);
      res.send(result)
    })










    //announcement

    app.post('/ad-announcement', async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement)
      res.send(result)
    })

    app.get('/announcement', async (req, res) => {
      const result = await announcementCollection.find().toArray()
      res.send(result)
    })



    // stripe
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })

      res.send({
        clientSecret: paymentIntent.client_secret
      })

    })

    app.patch('/payments/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { userMail: email };
      const updatedDoc = {
        $set: {
          membership: 'gold'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);
    });




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

