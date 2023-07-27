const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express()
require('dotenv').config()

app.use(express.json())
app.use(cors())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.f1hhq8d.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send('unauthorized access ')
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next()
    })

}

async function run() {
    try {

        const appointmentOptionsCollection = client.db('docorsChamber').collection('appointmentOptions')
        const bookingsCollection = client.db('docorsChamber').collection('booking')
        const usersCollection = client.db('docorsChamber').collection('users')
        const doctorsCollection = client.db('docorsChamber').collection('doctors')

        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;

            const query = {}
            const bookingQuery = { appointmentDate: date }

            const options = await appointmentOptionsCollection.find(query).toArray()
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()

            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
                const bookedSlots = optionBooked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots

            })

            res.send(options)
        })
        app.get('/appointmentSpecialty', async (req, res) => {
            const query = {}
            const result = await appointmentOptionsCollection.find(query).project({ name: 1 }).toArray()
            res.send(result)
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token })
            }
            console.log(user)
            res.status(403).send({ accessToken: '' })

        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const email = req.query.email;
            console.log(req.decoded.email)
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/users', async (req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray()
            res.send(users)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.post('/doctors', async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor)
            res.send(result)
        })

        app.get('/doctors', async (req, res) => {
            const query = {}
            const doctors = await doctorsCollection.find(query).toArray()
            res.send(doctors)
        })

        app.delete('/doctors/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await doctorsCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })



        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "admin") {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result)

        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                treatment: booking.treatment,
                email: booking.email
            }

            const booked = await bookingsCollection.find(query).toArray()
            console.log(booked)

            if (booked.length) {
                const message = `You already have a booking on ${booking.treatment}`
                return res.send({ acknowledge: false, message })
            }

            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })


        app.delete('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingsCollection.deleteOne(query)
            res.send(result)
        })



    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('doctors chamber is running ')
})

app.listen(port, () => {
    console.log(`doctors portal is running on ${port}`)
})


