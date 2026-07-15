import { MenuCategory } from "./types";

export const menuData: MenuCategory[] = [
  {
    category: "Pizza",
    items: [
      {
        name: "Farmhouse Pizza",
        price: 299,
        desc: "Loaded with fresh farm vegetables, bell peppers, onions, and mushrooms.",
        img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 92
      },
      { 
        name: "Margherita Pizza", 
        price: 249, 
        desc: "Classic cheese pizza with authentic Italian marinara sauce and fresh basil.", 
        img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 88
      },
      { 
        name: "Veg Supreme Pizza", 
        price: 349, 
        desc: "Premium olives, jalapeños, sweet corn, and baby corn with extra mozzarella.",
        img: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 85
      }
    ]
  },
  {
    category: "Burgers",
    items: [
      {
        name: "Cheese Burger",
        price: 199,
        desc: "Juicy burger featuring melted cheddar, fresh lettuce, and our house special sauce.",
        img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: false,
        popularity_score: 90
      },
      { 
        name: "Veg Burger",
        price: 149, 
        desc: "Crispy farm-fresh veggie patty with tomato, lettuce, and creamy mayonnaise.",
        img: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 78
      },
      { 
        name: "Double Patty Burger", 
        price: 249, 
        desc: "Double flame-grilled patties, double cheddar cheese, pickles, and crisp onions.",
        img: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: false,
        popularity_score: 95
      }
    ]
  },
  {
    category: "Pasta",
    items: [
      {
        name: "White Sauce Pasta",
        price: 249,
        desc: "Creamy bechamel sauce with exotic broccoli, baby corn, and premium herbs.",
        img: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 82
      },
      { 
        name: "Red Sauce Pasta", 
        price: 229, 
        desc: "Tangy fresh tomato concasse sauce cooked with bell peppers, olives, and garlic.",
        img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 80
      },
      { 
        name: "Mix Sauce Pasta",
        price: 269,
        desc: "A rich combination of cream and tomato sauce offering the ultimate pink pasta experience.",
        img: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 84
      }
    ]
  },
  {
    category: "Sides",
    items: [
      {
        name: "French Fries",
        price: 99,
        desc: "Crispy, golden, seasoned potato fries served with classic ketchup.",
        img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 87
      },
      { 
        name: "Garlic Bread",
        price: 129, 
        desc: "Cheesy golden garlic bread toasted with mozzarella cheese and a hint of butter.",
        img: "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 86
      },
      { 
        name: "Cheese Nuggets",
        price: 149, 
        desc: "Crunchy golden nuggets stuffed with creamy cheese and herbs.",
        img: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 83
      }
    ]
  },
  {
    category: "Sandwich",
    items: [
      {
        name: "Veg Sandwich",
        price: 119,
        desc: "Healthy double-decker sandwich loaded with fresh veggies and mint chutney.",
        img: "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 75
      },
      {
        name: "Grilled Sandwich",
        price: 149,
        desc: "Crispy grilled sandwich with golden corn, cheese, and vegetables.",
        img: "https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 79
      },
      {
        name: "Club Sandwich",
        price: 199,
        desc: "Classic three-layered sandwich with grilled fillings, cheese, and tomatoes.",
        img: "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: false,
        popularity_score: 89
      }
    ]
  },
  {
    category: "Drinks",
    items: [
      {
        name: "Coca Cola",
        price: 49,
        desc: "Chilled classic soft drink to perfectly complement your meal.",
        img: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 76
      },
      {
        name: "Mango Shake",
        price: 99,
        desc: "Thick and luscious shake made with natural Alphonso mango pulp.",
        img: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 81
      },
      {
        name: "Cold Coffee",
        price: 129,
        desc: "Rich, creamy, blended cold coffee topped with fine dark cocoa.",
        img: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 77
      }
    ]
  },
  {
    category: "Desserts",
    items: [
      {
        name: "Chocolate Cake",
        price: 149,
        desc: "Decadent and moist chocolate cake layered with rich fudge ganache.",
        img: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 91
      },
      {
        name: "Brownie",
        price: 99,
        desc: "Fudgy warm chocolate brownie made with rich cocoa and nuts.",
        img: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 87
      },
      {
        name: "Ice Cream Sundae",
        price: 129,
        desc: "Vanilla ice cream scoops topped with hot chocolate fudge and maraschino cherries.",
        img: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 85
      }
    ]
  },
  {
    category: "Combos",
    items: [
      {
        name: "Pizza Combo",
        price: 399,
        desc: "Any medium pizza of your choice paired with a chilled soft drink.",
        img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: true,
        popularity_score: 88
      },
      {
        name: "Burger Combo",
        price: 299,
        desc: "One signature burger, side of golden french fries, and a chilled drink.",
        img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: false,
        popularity_score: 94
      },
      {
        name: "Family Combo",
        price: 799,
        desc: "1 Large Veg Supreme Pizza, 2 Veg Burgers, 1 French Fries, and 4 Drinks.",
        img: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=500&auto=format&fit=crop&q=60",
        is_vegetarian: false,
        popularity_score: 93
      }
    ]
  }
];
