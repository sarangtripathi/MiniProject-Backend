const express = require('express');
const app = express();
const userModel = require('./models/user');
const postModel = require('./models/post');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const path = require("path");
const upload = require("./config/multerconfig");

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname,"public")));
app.use(cookieParser());

app.get('/', (req,res) => {
    res.render("index");
})
app.get('/login', (req,res) => {
    res.render("login");
})
app.get('/logout', (req,res) => {
    res.cookie("token","");
    res.redirect("/login");
})

app.get('/profile', isLoggedIn, async (req,res) => {
  let user = await userModel.findOne({email: req.user.email}).populate("posts");
  // user.populate("posts");
  
  res.render("profile", {user})
  
});
app.get('/dashboard', isLoggedIn, async (req,res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let posts = await postModel.find().populate("user");
  
  res.render("dashboard", {posts,user})
  
});

app.get('/profile/upload', (req,res) => {
  res.render("profileupload");
  
});

app.post('/upload',isLoggedIn, upload.single("image"), async (req,res) => {
  // console.log(req.file);
  let user = await userModel.findOne({email: req.user.email});
  user.profilepic = req.file.filename;
  await user.save()
  res.redirect("/profile")
});

app.post('/post', isLoggedIn, async (req,res) => {
  let user = await userModel.findOne({email: req.user.email});
  let {content,likes} =req.body;
  let post = await postModel.create({
    user: user._id,
    // date, default given in model
    content
  })
  
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
  
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel
    .findOne({ _id : req.params.id })
    .populate("user");

  if(post.likes.indexOf(req.user.userid) === -1){
    post.likes.push(req.user.userid);
    
  }
  else{
    post.likes.splice(post.likes.indexOf(req.user.userid),1);
  }

   await post.save();

  // res.redirect("/profile");
  res.redirect(req.get("referer")); //to redirect onto the same page that initiated req
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel
    .findOne({ _id : req.params.id })
    .populate("user");

  res.render("edit",{post});
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  let post = await postModel
    .findOneAndUpdate({ _id : req.params.id },{content : req.body.content});

  res.redirect("/profile");
});

// app.get('/allUsers' , async(req,res) => {
//   const data = await userModel.find();
//   res.json(data);
// })

app.post('/register', async (req,res) => {
    let {username, name, age,email,password} = req.body;
    let userExist = await userModel.findOne({email});
    if(userExist) return res.status(500).send("User already registered!");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // console.log(hashedPassword);
    
    let user = await userModel.create({
      username,
      name,
      email,
      age,
      password: hashedPassword,
    });
    
    let token = jwt.sign({email: email, userid: user._id}, "shh");
    res.cookie("token", token);

    // res.send("registered");
    res.redirect("/dashboard");

})

app.post("/login", async (req, res) => {
  let {email, password } = req.body;
  let userExist = await userModel.findOne({ email });
  if (!userExist) return res.status(500).send("Something went wrong");

  bcrypt.compare(password, userExist.password, function(err,result){
    if(result){ 
      let token = jwt.sign({ email: email, userid: userExist._id }, "shh");
      res.cookie("token", token);
      res.status(200).redirect("/dashboard");
    }
    else res.redirect("/login")
  })
});

function isLoggedIn(req,res,next){
  if(req.cookies.token=== "") res.redirect("/login");
  else{
    let data = jwt.verify(req.cookies.token , "shh")
    // console.log(data);
    
    req.user = data;
    next();
  }
}


app.listen(3000)