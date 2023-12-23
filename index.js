const express = require('express');
const app=express()
require('dotenv').config()
const cors = require('cors');
const port =process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.2veuzlp.mongodb.net/?retryWrites=true&w=majority`;

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

    const menuCollection = client.db("TastyTraverse").collection("Menu");
    const reviewCollection = client.db("TastyTraverse").collection("reviews");
    const CartCollection = client.db("TastyTraverse").collection("carts");
    // menu data load on server
    app.get('/menu',async(req,res)=>{
        const result =await menuCollection.find().toArray();
        res.send(result)
    })

    // reviews data load on server
    app.get('/reviews',async(req,res)=>{
        const result =await reviewCollection.find().toArray();
        res.send(result)
    })

    // cart collection

    app.get('/carts',async(req,res)=>{
      const email =req.query.email
      console.log(email)
      if(!email){
        res.send([])
      }
      const query = { email: email };
      const result =await CartCollection.find(query).toArray();
      res.send(result)


    })

    app.post('/carts',async(req,res)=>{
      const item = req.body
      console.log(item)
      const result = await CartCollection.insertOne(item);
      res.send(result)
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
    res.send('tasty traverse is running')
  })
  
  app.listen(port, () => {
    console.log(`tasty traverse is running on port: ${port}`)
  })