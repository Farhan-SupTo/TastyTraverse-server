const express = require('express');
const app=express()
require('dotenv').config()
const cors = require('cors');
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)

const port =process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())

const jwtVerify =(req,res,next) =>{
  const authorization =req.headers.authorization
  if(!authorization){
    return res.status(401).send({error:true,message:'unauthorized access'})
  }
  // bearer token
  const token =authorization.split(' ')[1]
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({error:true,message:'unauthorized access'})
    }
    req.decoded =decoded
    next()
  })

}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const usersCollection = client.db("TastyTraverse").collection("users");
    const paymentCollection = client.db("TastyTraverse").collection("payments");


    // TOKEN SETUP

    app.post('/jwt',(req,res)=>{
      const user=req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{ expiresIn: '1h' });
      res.send({token})

    })
        // Warning: use verifyJWT before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
          const email = req.decoded.email;
          const query = { email: email }
          const user = await usersCollection.findOne(query);
          if (user?.role !== 'admin') {
            return res.status(403).send({ error: true, message: 'forbidden message' });
          }
          next();
        }
 
    // user related api

    // use jwt token-verify jwt
    // donot show the secure links to those who should not see this

    app.get('/users',jwtVerify,verifyAdmin,async(req,res)=>{
      const result =await usersCollection.find().toArray()
      res.send(result)
    })

       
    app.post('/users',async(req,res)=>{
      const user =req.body
      console.log(user)
      const query ={email:user.email}
      const existingUser =await usersCollection.findOne(query)
      console.log('existing User',existingUser)
      if(existingUser){
        return res.send({message:'user already exists'})
      }
     
      const result =await usersCollection.insertOne(user);
      res.send(result)
    })

    app.patch('/users/admin/:id',async(req,res)=>{
      const id =req.params.id
      const filter = { _id: new ObjectId (id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // security layer=verify jwt
    // email same
    // check admin
    app.get('/users/admin/:email',jwtVerify,async(req,res)=>{
      const email =req.params.email 

        if(req.decoded.email !== email){
          res.send({admin: false})
        }

      const query ={email: email}
      const user =await usersCollection.findOne(query)
      const result ={admin: user?.role === 'admin'}
      res.send(result)
    })


    // menu data load on server
    app.get('/menu',async(req,res)=>{
        const result =await menuCollection.find().toArray();
        res.send(result)
    })
    // delete item from manage user using delete operation

    app.delete('/menu/:id',jwtVerify,verifyAdmin,async(req,res)=>{
      const id=req.params.id 
      const query ={ _id: new ObjectId(id)}
      const result =await menuCollection.deleteOne(query)
      res.send(result)
    })

    // add cart data to backend

    app.post('/menu',jwtVerify,verifyAdmin,async(req,res)=>{
      const newItem =req.body
      const result =await menuCollection.insertOne(newItem)
      res.send(result)
    })

    // reviews related
    app.get('/reviews',async(req,res)=>{
        const result =await reviewCollection.find().toArray();
        res.send(result)
    })

    // cart collection cart relate api

    app.get('/carts',jwtVerify,async(req,res)=>{
      const email =req.query.email
      if(!email){
        res.send([])
      }

      const decodedEmail =req.decoded.email
      if(email !== decodedEmail){
        return res.status(403).send({error:true,message:'forbidden access'})
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

    app.delete('/carts/:id',async(req,res)=>{
      const id =req.params.id
      const query = { _id: new ObjectId(id) };
      const result = await CartCollection.deleteOne(query);
      res.send(result)
    })

    // CREATE PAYMENTS INTENT

    app.post("/create-payment-intent",jwtVerify, async (req, res) =>{
      const {price} =req.body
      
      const amount =price*100
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: [
          "card"
        ],
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      });

    })

    // payment section

    app.post('/payments',jwtVerify,async(req,res)=>{
      const payment =req.body 
      const insertResult =await paymentCollection.insertOne(payment) 
      
      const query ={_id: { $in: payment.cartItems.map(id=> new ObjectId(id))}}
      const deletedResult =await CartCollection.deleteMany(query)
    
      
      res.send({deletedResult,insertResult})
    })

    // admin dashboard chart show

    app.get('/admin-stats',jwtVerify,verifyAdmin, async(req,res)=>{
      const users =await usersCollection.estimatedDocumentCount()
      const products =await menuCollection.estimatedDocumentCount()
      const Orders =await paymentCollection.estimatedDocumentCount()


       const payments =await paymentCollection.find().toArray()
       const Revenue =payments.reduce((sum,payment)=> sum + payment.price,0)

      res.send({
        users,
        products,
        Orders,
        Revenue
      })
    })


    // show graph data using pipelining

  //   * 1. load all payments
  //   * 2. for each payment, get the menuItems array
  //   * 3. for each item in the menuItems array get the menuItem from the menu collection
  //   * 4. put them in an array: allOrderedItems
  //   * 5. separate allOrderedItems by category using filter
  //   * 6. now get the quantity by using length: pizzas.length
  //   * 7. for each category use reduce to get the total amount spent on this category
  //   * 
  //  */
   app.get('/order-stats',jwtVerify,verifyAdmin,async(req, res) =>{
     const pipeline = [
       {
         $lookup: {
           from: 'Menu',
           localField: 'menuItems',
           foreignField: '_id',
           as: 'menuItemsData'
         }
       },
       {
         $unwind: '$menuItemsData'
       },
       {
         $group: {
           _id: '$menuItemsData.category',
           count: { $sum: 1 },
           total: { $sum: '$menuItemsData.price' }
         }
       },
       {
         $project: {
           category: '$_id',
           count: 1,
           total: { $round: ['$total', 2] },
           _id: 0
         }
       }
     ];

     const result = await paymentCollection.aggregate(pipeline).toArray()
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