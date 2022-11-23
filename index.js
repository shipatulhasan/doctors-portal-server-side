const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000
const app = express()

const stripe = require("stripe")(process.env.STRIPE_SECRET);

// middleware

app.use(cors())
app.use(express.json())

// connection api

app.get('/',(req,res)=>{
    res.send('Hello bubu from node')
})

// jwt token

const verifyJWT = (req,res,next)=>{
    const auth = req.headers.authorization
    if(!auth){
        return res.status(401).send({message:'unauthorized'})

    }

    const token = auth.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, function(err, decoded) {
        if(err){
            return res.status(403).send({message:'forbidden'})
        }
        req.decoded = decoded
        next()
      });
      
      
}


// mongodb connection


// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0vh6mry.mongodb.net/?retryWrites=true&w=majority`;
const uri = "mongodb+srv://dbUser1:D6BfjeL6tYekaL8z@cluster0.0vh6mry.mongodb.net/test"
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const run = async()=>{
    try{
        const appointmentOptionCollection = client.db("doctorsPortal").collection("appointmentOptions");
        const bookingsCollection = client.db("doctorsPortal").collection("bookings");
        const usersCollection = client.db("doctorsPortal").collection("users");
        const doctorsCollection = client.db("doctorsPortal").collection("doctors");
        const paymentsCollection = client.db("doctorsPortal").collection("payments");

        /**
         * send date from client
         * make a query based on booking date and get all booked data
         * booking service name which is already booked
         * get each option by using for each
         * filter all the slots
         * repla
         * 
         */

        const verifyAdmin = async(req,res,next)=>{

            const decodedEmail = req.decoded.email
            const query = {email:decodedEmail}
            const user = await usersCollection.findOne(query)
            if(user?.role!=='admin'){
                return res.status(403).send({message:'forbidden'})
            }
            // res.send(user)
            next()


        }

        // it's a temporary price update
        // app.get('/addprice', async(req,res)=>{
        //     const filter = {}
        //     const options = { upsert: true }
        //     const updateDoc = {
        //         $set:{
        //             price:100
        //         }
        //     }
        //     const result = await appointmentOptionCollection.updateMany(filter, updateDoc, options)
        //     res.send(result)
        // })
        // 

        // payment
        app.post("/create-payment-intent", async (req, res) =>{

            const booking = req.body
            const price = booking.price
            const amount = price * 100
            const paymentIntent = await stripe.paymentIntents.create({
                currency:'usd',
                amount :amount,
                payment_method_types: [
                    "card"
                  ],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
              })
        })

        app.post('/payments',verifyJWT,async(req,res)=>{
            const payment = req.body
            const id = payment.bookingId
            const filter = {_id:ObjectId(id)}
            const updatedDoc = {
                $set:{
                    paid:true,
                    transactionId:payment.transactionID
                }
            } 
            const result = await paymentsCollection.insertOne(payment)
            const updateResult = await bookingsCollection.updateOne(filter,updatedDoc)
            res.send(result)
        })

        app.get('/appointmentOpotions',async(req,res)=>{
            const date = req.query.date
            const query = {}
            const bookingQuery = {appointment_date:date}
            const options = await appointmentOptionCollection.find(query).toArray()
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()

            options.forEach(option=>{
                const bookedOption = alreadyBooked.filter(book=>book.treatement=== option.name) 
                const bookedSlots = bookedOption.map(book=> book.slot)

                const remainingSlots = option.slots.filter(slot=>!bookedSlots.includes(slot))
                option.slots=remainingSlots

                // console.log(date,option.name,remainingSlots.length)
            })

            
            res.send(options)
        })

        app.get('/appointmentspeciality',async(req,res)=>{
            const query = {}
            const result = await appointmentOptionCollection.find(query).project({name:1}).toArray()
            res.send(result)
        })

        app.get('/users',async(req,res)=>{
            const query = {}
            const result = await usersCollection.find(query).toArray()
            res.send(result)
          })
      


        // booking

        app.get('/bookings/:id',async(req,res)=>{
            const id = req.params.id
            const filter = {_id:ObjectId(id)}
            const result = await bookingsCollection.findOne(filter) 
            res.send(result)

        })

        app.get('/bookings',verifyJWT,async(req,res)=>{
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if(email !== decodedEmail){
                return res.status(403).send({message:'forbidden'})
            }
            
            let query = {}
            if(email){
                query = {email:email}
            }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        })

        app.get ('/jwt',async(req,res)=>{
            const email = req.query.email
            const query = {email:email}
            const user = await usersCollection.findOne(query)
            if(user){
                token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, { expiresIn: '1d' });
               return res.send({accessToken:token})
            }
            return res.status(401).send({accessToken:''})

            
        })


        // POST ROUTE
        app.post('/user',async(req,res)=>{
            const user = req.body
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.post('/bookings',async(req,res)=>{

            const booking = req.body
            const query = {
                appointment_date:booking.appointment_date,
                treatement:booking.treatement,
                email:booking.email,
            }

            const alreadyBooked = await bookingsCollection.find(query).toArray()
            

            if(alreadyBooked.length){

                const message = (`your have already an appointment on ${booking.appointment_date} for ${booking.treatement}`)

                return res.send({ acknowledged: false, message })
            }
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)

        })

        app.get('/users/admin/:email', async(req,res)=>{
            const email = req.params.email
            const query = {email:email}
            const user = await usersCollection.findOne(query)
            
            res.send({isAdmin:user?.role==='admin'})
        })

        // make admin
        app.put('/users/admin/:id',verifyJWT,verifyAdmin,async(req,res)=>{

            const id = req.params.id
            const filter= {_id:ObjectId(id)}
            const options = { upsert: true };
            const updateDoc={
                $set:{
                    role:'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })


        // admin functionality
        app.post('/doctors',verifyJWT,verifyAdmin,async(req,res)=>{
            const doctor = req.body
            const result = await doctorsCollection.insertOne(doctor)
            res.send(result)
        })
        app.get('/doctors',verifyJWT,verifyAdmin,async(req,res)=>{
            const query = {}
            const result = await doctorsCollection.find(query).toArray()
            res.send(result)
          })

        app.delete('/doctors/:id',verifyJWT,verifyAdmin,async(req,res)=>{
            const id = req.params.id

            const filter = {_id:ObjectId(id)}
            const result = await doctorsCollection.deleteOne(filter)
            console.log(result)
            res.send(result)
        })
        

    }
    finally{

    }
}
run().catch(console.dir)


// 





app.listen(port,()=>console.log(`Doctor portal running on ${port}`))