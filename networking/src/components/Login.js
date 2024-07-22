import React, { useState } from "react";


function Login(){
    const [loginUsername, setLogin] = useState({
        username: "",
        lpassword: ""
    
    })
 
    function hanndlelogin(e){
    let value = e.target.value;
    let name = e.target.name;
    setLogin({
        ...loginUsername,
        [name]: value
    })

    }

    return(
        <>
         <form method="post">
            <div className="registration-container">
                <div className="info-component">
                    <div className="title-container">
                    <h1 className="regis-header">Login</h1>
                    </div>
                    <div>
                    <label className="reg-title">Email</label><br></br>
                    <input 
                    className="sign-input"  
                    type="email" 
                    placeholder="Enter email..." 
                    size="70" name="email" 
                    onClick={hanndlelogin}
                   
                    ></input>
                    </div>
                    <div>                  
                    </div>

                    <div>
                    <label className="reg-title">Password</label><br></br>
                    <input 
                    className="sign-input"  
                    type="password" 
                    placeholder="Enter password..."
                     size="70" 
                     name="password" 
                     autoComplete="none" 
                     onClick={hanndlelogin}
                   
                     ></input>
                    </div>
                    <button type="submit" className="sign-button">Login</button>
                   
                    {/* <Button className="reg-button sign-input" variant="primary" type="submit">Register</Button> */}
                </div>
            </div>
        </form>
        </>
    )
}
 

export default Login;