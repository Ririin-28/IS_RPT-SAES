from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Add CORS middleware to allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/login")
def login(request: LoginRequest):
    # Dummy credentials
    if request.username == "proponent" and request.password == "password":
        return {
            "message": "Login successful",
            "userType": "proponent",
            "redirect": "/Proponent/welcome"  # Update this to your proponent route
        }
    if request.username == "teacher" and request.password == "password":
        return {
            "message": "Login successful",
            "userType": "teacher",
            "redirect": "/Teacher/dashboard"  # Update this to your teacher route
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")