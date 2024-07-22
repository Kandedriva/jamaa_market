import React, { useEffect } from "react";
import { useState } from "react";
import axios from "axios";

function Registration(){

// const [register, setRegister] = useState({
//     userName: "",
//     email: "",
//     password: ""
// })
const [username, setUsername] = useState("")
const [email, setEmail] = useState("")
const [password, setPassword] = useState("")

const [home, setHome] = useState("")


function handleSubmit(e){
  e.preventDefault();
  const userData = {
    username,
    email,
    password,
  };

axios.post("http://localhost:5001/registration", userData)
.then(res =>console.log(res.data))
.catch(error =>console.error("There is an error..!", error))
} 



    return(
        <>

 <form onSubmit={handleSubmit}>
<div className="registration-container">
 <div className="info-component">
<div className="title-container">
<h1 className="regis-header">Registration</h1>
</div>
<div>
<label className="reg-title">Username</label>
</div>
<div>
                    <input 
                    required
                    className="sign-input" 
                    type="text"
                     placeholder="Enter a user Username..." 
                     size="70" 
                     name="userName"
                     value={username}
                     onChange={(e)=> setUsername(e.target.value)}
                    ></input>
                    </div>

                    <div>
                    <label className="reg-title">Email</label><br></br>
                    <input 
                    required
                    className="sign-input"
                      type="email" 
                      placeholder="Enter email..." 
                      size="70" 
                      name="email"
                      value={email} 
                      onChange={e =>setEmail(e.target.value)}
                      ></input>
 </div>
    
  <div>
                    <label className="reg-title">Password</label><br></br>
                    <input 
                    required
                    className="sign-input"  
                    type="password" 
                    placeholder="Enter password..." 
                    size="70" 
                    name="password" 
                    autoComplete="none" 
                    value={password}
                    onChange={e =>setPassword(e.target.value)}
                    ></input>
                    </div>
                    <button type="submit" className="sign-button">SignUp</button>
                   
                    {/* <Button className="reg-button sign-input" variant="primary" type="submit">Register</Button> */}
                </div>
            </div>
        </form>
        </>
    )
}

export default Registration