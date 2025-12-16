from fastapi import FastAPI, Path
from typing import Optional   # If we need to use Optional type 
from pydantic import BaseModel

l= {
    "Naruto":{
        "Jutsu": "Nine Tails Chakra Mode",
        "Village": "Leaf"
    },
    "Sasuke":{
        "Jutsu": "Dark",
        "Village": "Leaf"
    }
    }

class Ninja(BaseModel):
    name: str
    Jutsu: str
    Village: str

app= FastAPI()
@app.get("/")
def home():
    return {"message": "Hello, World!"}

@app.get("//")
def home1():
    return {"message": "Hello, World!!!!!!!!!!!!"}

#Path parameter
@app.get("/get-ninja/{name}")
def exp(name: str = Path(..., description="The name of the ninja to get"), 
        num: Optional[int] = Path(..., description="The number of the ninja to get", gt=0)):
    return l[name]

#Query parameter
@app.get("/get-ninja-alt")
def exp(name: Optional[str]= None ):
    if not name:
        return {"error": "No Data found"}
    return l[name]

@app.post("/create-ninja")
def create_ninja(item: Ninja):
    if item.name in l.keys():
        return {"error": "Ninja already exists"}
    l[item.name]= {"Jutsu": item.Jutsu, "Village": item.Village}
    return l[item.name]

@app.put("/update-ninja")
def update_ninja(item: Ninja):
    if item.name not in l.keys():
        return {"error": "Ninja does not exist"}
    if item.Jutsu != None:
        l[item.name]["Jutsu"]= item.Jutsu
    if item.Village != None:
        l[item.name]["Village"]= item.Village
    return l[item.name]

@app.delete("/delete-ninja/{name}")
def delete_ninja(name: str = Path(..., description="The name of the ninja to delete")):
    if name not in l.keys():
        return {"error": "Ninja does not exist"}
    del l[name]
    return {"message": "Ninja deleted successfully"}