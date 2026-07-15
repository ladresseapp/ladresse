import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ─── SUPABASE CLIENT ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://pyvruioduqkyiwezqmdh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5dnJ1aW9kdXFreWl3ZXpxbWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODU1NzMsImV4cCI6MjA5MTY2MTU3M30.e31b6Apvd4VYYS-UOnCFzKAd-0YuTNu7ZhPClmZQPMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sanitizeHTML = (str) => {
  if (typeof str !== 'string') return '';
  const map = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;' };
  return str.replace(/[&<>"'`=/]/g, (char) => map[char]);
};
const sanitizeInput = (input, maxLength = 1000) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength);
};
const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
};
const isValidSiret = (siret) => {
  if (!siret) return true;
  return /^\d{14}$/.test(siret.replace(/\s/g, ''));
};


const S = {
  overlay: { position:"fixed", inset:0, background:"rgba(18,8,10,0.72)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"12px", backdropFilter:"blur(6px)" },
  modal: { background:"#FFF", borderRadius:20, padding:"22px 18px 28px", width:"100%", maxHeight:"93vh", overflowY:"auto", boxShadow:"0 32px 80px rgba(0,0,0,0.3)", position:"relative" },
  closeBtn: { position:"absolute", top:14, right:14, background:"rgba(0,0,0,0.1)", border:"none", width:30, height:30, borderRadius:"50%", cursor:"pointer", fontSize:13, color:"#666", display:"flex", alignItems:"center", justifyContent:"center" },
  input: { width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid #E8E0D8", fontSize:14, color:"#2D1A00", fontFamily:"'Lato',sans-serif", outline:"none", boxSizing:"border-box", background:"#FAFAF8" },
  label: { display:"block", fontSize:11, color:"#AAA", marginBottom:4, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" },
  btnPrimary: { background:"linear-gradient(135deg,#C8914A,#E8C882)", color:"#1A0A00", border:"none", padding:"10px 22px", borderRadius:30, fontWeight:800, cursor:"pointer", fontSize:14, fontFamily:"'Lato',sans-serif", boxShadow:"0 4px 16px rgba(200,145,74,0.4)", transition:"all .2s" },
  btnOutline: { background:"none", color:"#C8914A", border:"1.5px solid #C8914A", padding:"10px 22px", borderRadius:30, fontWeight:700, cursor:"pointer", fontSize:14, fontFamily:"'Lato',sans-serif", transition:"all .2s" }
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
};

const useEscapeKey = (handler) => {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handler(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [handler]);
};

function isOpenNow(schedule) {
  if (!schedule?.length) return false;
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const hm = now.getHours() * 60 + now.getMinutes();
  for (const slot of schedule) {
    if (!slot.days.includes(day)) continue;
    const [oh, om] = slot.open.split(":").map(Number);
    const [ch, cm] = slot.close.split(":").map(Number);
    const o = oh * 60 + om;
    let c = ch * 60 + cm;
    if (c < o) c += 1440;
    const hm2 = (c < o && hm < o) ? hm + 1440 : hm;
    if (hm2 >= o && hm2 < c) return true;
  }
  return false;
}

function getStatusLabel(schedule) {
  if (!schedule?.length) return { open: false, label: "Fermé" };
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const hm = now.getHours() * 60 + now.getMinutes();
  const todaySlots = schedule.filter(s => s.days.includes(day));
  if (!todaySlots.length) return { open: false, label: "Fermé aujourd'hui" };
  if (isOpenNow(schedule)) {
    for (const slot of todaySlots) {
      const [oh, om] = slot.open.split(":").map(Number);
      const [ch, cm] = slot.close.split(":").map(Number);
      const o = oh * 60 + om; let c = ch * 60 + cm;
      if (c < o) c += 1440;
      const hm2 = (c < o && hm < o) ? hm + 1440 : hm;
      if (hm2 >= o && hm2 < c) return { open: true, label: `Ouvert · ferme à ${slot.close}` };
    }
    return { open: true, label: "Ouvert" };
  }
  for (const slot of todaySlots) {
    const [oh, om] = slot.open.split(":").map(Number);
    if (hm < oh * 60 + om) return { open: false, label: `Ouvre à ${slot.open}` };
  }
  return { open: false, label: "Fermé" };
}

function formatSchedule(schedule) {
  if (!schedule?.length) return [];
  const dn = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  return schedule.map(s => {
    const days = s.days.map(d => dn[d]);
    const ds = days.length >= 3 ? `${days[0]}–${days[days.length-1]}` : days.join(", ");
    return `${ds} · ${s.open} – ${s.close}`;
  });
}

function matchHoraire(lieu, horaire) {
  if (horaire === "tous") return true;
  if (horaire === "open_now") return isOpenNow(lieu.schedule);
  const ranges = { lunch:[660,900], dinner:[1080,1380], late:[1380,1560] };
  const [rS,rE] = ranges[horaire] || [0,1440];
  for (const slot of lieu.schedule) {
    const [oh,om] = slot.open.split(":").map(Number);
    const [ch,cm] = slot.close.split(":").map(Number);
    const o = oh*60+om; let c = ch*60+cm;
    if (c < o) c += 1440;
    if (o < rE && c > rS) return true;
  }
  return false;
}

const PHOTOS = {
  1:["https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&q=80","https://images.unsplash.com/photo-1559339352-11d035aa65de?w=700&q=80","https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=700&q=80"],
  2:["https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=700&q=80","https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=700&q=80","https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=700&q=80"],
  3:["https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=700&q=80","https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=700&q=80","https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=700&q=80"],
  4:["https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=700&q=80","https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=700&q=80","https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=700&q=80"],
  5:["https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=700&q=80","https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=700&q=80","https://images.unsplash.com/photo-1593642533144-3d62aa4783ec?w=700&q=80"],
  6:["https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?w=700&q=80","https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?w=700&q=80","https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=700&q=80"],
  7:["https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=700&q=80","https://images.unsplash.com/photo-1560512823-829485b8bf24?w=700&q=80","https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=700&q=80"],
  8:["https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=700&q=80","https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=700&q=80","https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=700&q=80"],
  9:["https://images.unsplash.com/photo-1532634993-15f421e42ec0?w=700&q=80","https://images.unsplash.com/photo-1608270586620-248524c67de9?w=700&q=80","https://images.unsplash.com/photo-1559526323-cb2f2fe2591b?w=700&q=80"],
};

const LIEUX = [
  { id:1, categorie:"restaurant", name:"Le Jardin Secret", type:"Français", arrondissement:"75006", ambiance:"Romantique", note:4.8, tempsRoute:5, adresse:"12 Rue de Buci, Paris 75006", tel:"01 43 26 XX XX", priceRange:"€€€", tags:["Bistronomie","Terroir","Vin naturel"], premium:true, places:40, description:"Un écrin de verdure en plein cœur de Saint-Germain. La cuisine du chef joue sur les saisons avec une carte qui change chaque mois.", coords:{lat:48.8534,lng:2.3352}, schedule:[{days:[0,1,2,3,4,5],open:"12:00",close:"14:30"},{days:[0,1,2,3,4,5],open:"19:00",close:"22:30"}], social:{instagram:"@lejardin_secret",facebook:"LeJardinSecretParis",tiktok:"@lejardin.secret"}, menu:[{cat:"Entrées",items:[{nom:"Velouté de châtaigne, crème fumée",prix:"14€"},{nom:"Foie gras mi-cuit, chutney de figues",prix:"22€"},{nom:"Tartare de Saint-Jacques",prix:"18€"}]},{cat:"Plats",items:[{nom:"Filet de bœuf, jus réduit au vin rouge",prix:"38€"},{nom:"Turbot sauvage, beurre nantais",prix:"42€"},{nom:"Risotto aux cèpes et parmesan",prix:"28€"}]},{cat:"Desserts",items:[{nom:"Soufflé au Grand Marnier",prix:"14€"},{nom:"Tarte fine aux pommes caramélisées",prix:"12€"}]}], offers:[{titre:"Menu déjeuner express",desc:"Entrée + plat ou plat + dessert",prix:"28€",validite:"Lun–Ven midi",emoji:"🌿"}], events:[{titre:"Soirée accords mets & vins",date:"Sam 15 Fév",desc:"Le chef et notre sommelier vous guident à travers 5 plats et 5 vins d'exception.",emoji:"🍷",places:20}], avis:[{auteur:"Sophie M.",note:5,date:"Jan 2025",texte:"Dîner de rêve pour notre anniversaire. Service impeccable et cuisine époustouflante.",verifie:true},{auteur:"Laurent D.",note:5,date:"Déc 2024",texte:"La meilleure adresse de Saint-Germain. On y revient chaque saison.",verifie:true}] },
  { id:2, categorie:"restaurant", name:"Umami Tokyo", type:"Japonais", arrondissement:"75001", ambiance:"Zen", note:4.9, tempsRoute:12, adresse:"8 Rue Sainte-Anne, Paris 75001", tel:"01 42 86 XX XX", priceRange:"€€€€", tags:["Omakase","Sushi","Wagyu"], premium:true, places:12, description:"Une expérience immersive dans la cuisine japonaise fine. Comptoir en bois de hinoki, 12 couverts, service omakase sur réservation.", coords:{lat:48.8641,lng:2.3345}, schedule:[{days:[1,2,3,4,5,6],open:"12:00",close:"14:00"},{days:[1,2,3,4,5,6],open:"19:00",close:"22:00"}], social:{instagram:"@umami.tokyo.paris",facebook:"UmamiTokyoParis",tiktok:"@umamitokyo"}, menu:[{cat:"Omakase",items:[{nom:"Menu Sakura — 8 services",prix:"120€"},{nom:"Menu Fuji — 12 services",prix:"185€"},{nom:"Menu Yuki — 16 services wagyu A5",prix:"280€"}]},{cat:"À la carte",items:[{nom:"Chirashi premium",prix:"65€"},{nom:"Plateau sashimi 12 pièces",prix:"55€"}]}], offers:[{titre:"Déjeuner Omakase",desc:"Menu 6 services au comptoir hinoki",prix:"75€",validite:"Mar–Dim midi",emoji:"🍣"}], events:[{titre:"Master class sushi",date:"Dim 2 Fév",desc:"Apprenez les techniques du chef Kenji pour préparer des nigiri parfaits.",emoji:"🥢",places:6},{titre:"Soirée Wagyu A5",date:"Ven 21 Fév",desc:"Menu spécial autour du bœuf wagyu A5 importé de la préfecture de Miyazaki.",emoji:"🥩",places:12}], avis:[{auteur:"Pierre L.",note:5,date:"Fév 2025",texte:"La meilleure expérience culinaire de ma vie. Le menu Fuji est une œuvre d'art.",verifie:true},{auteur:"Amélie R.",note:5,date:"Jan 2025",texte:"Impossible de trouver mieux à Paris. Le chef Kenji est un génie.",verifie:true}] },
  { id:3, categorie:"restaurant", name:"La Trattoria di Marco", type:"Italien", arrondissement:"75011", ambiance:"Convivial", note:4.5, tempsRoute:18, adresse:"24 Rue de la Roquette, Paris 75011", tel:"01 43 57 XX XX", priceRange:"€€", tags:["Pasta fraîche","Pizza napolitaine","Antipasti"], premium:false, places:60, description:"Marco cuisine comme sa nonna. Pâtes fraîches faites chaque matin, tomates San Marzano, mozzarella di bufala livrée chaque semaine.", coords:{lat:48.8538,lng:2.3732}, schedule:[{days:[0,1,2,3,4,5,6],open:"12:00",close:"23:00"}], social:{instagram:"@trattoria_di_marco",facebook:"TrattoriaDiMarcoParis",tiktok:""}, menu:[{cat:"Antipasti",items:[{nom:"Burrata pugliese",prix:"12€"},{nom:"Charcuterie italienne maison",prix:"16€"}]},{cat:"Pasta",items:[{nom:"Cacio e Pepe",prix:"18€"},{nom:"Rigatoni all'Amatriciana",prix:"17€"},{nom:"Tagliatelles au ragù 6h",prix:"19€"}]},{cat:"Pizza",items:[{nom:"Margherita bufala",prix:"16€"},{nom:"Pizza tartufo e funghi",prix:"22€"}]}], offers:[{titre:"Pasta del giorno",desc:"Pâte fraîche du jour + verre de vin",prix:"16€",validite:"Tous les jours midi",emoji:"🍝"},{titre:"Aperitivo Happy Hour",desc:"Prosecco + planche antipasti",prix:"12€",validite:"Lun–Ven 18h–20h",emoji:"🥂"}], events:[{titre:"Soirée Pizza Party",date:"Jeu 6 Fév",desc:"Buffet pizza à volonté, vins italiens et ambiance festive.",emoji:"🍕",places:40}], avis:[{auteur:"Julie T.",note:5,date:"Jan 2025",texte:"Les meilleures pâtes de Paris ! La cacio e pepe est divine.",verifie:true},{auteur:"Marc A.",note:4,date:"Déc 2024",texte:"Super adresse de quartier. Pizza authentiquement napolitaine.",verifie:true}] },
  { id:4, categorie:"restaurant", name:"Bistrot du Marché", type:"Français", arrondissement:"75004", ambiance:"Authentique", note:4.3, tempsRoute:8, adresse:"3 Rue des Blancs-Manteaux, Paris 75004", tel:"01 42 74 XX XX", priceRange:"€€", tags:["Bistrot","Canaille","Vins nature"], premium:true, places:35, description:"Le vrai bistrot parisien. Ardoise qui change, produits du marché, cuisine sans chichi mais pleine d'amour.", coords:{lat:48.8554,lng:2.3518}, schedule:[{days:[1,2,3,4,5],open:"12:00",close:"14:00"},{days:[1,2,3,4,5],open:"19:30",close:"22:00"}], social:{instagram:"@bistrotdumarche75",facebook:"BistrotDuMarcheParis",tiktok:"@bistrot.marche"}, menu:[{cat:"Ardoise du jour",items:[{nom:"Œuf parfait, lardons, champignons",prix:"13€"},{nom:"Terrine de campagne maison",prix:"10€"}]},{cat:"Plats",items:[{nom:"Steak frites, beurre maître d'hôtel",prix:"22€"},{nom:"Confit de canard, sarladaise",prix:"24€"},{nom:"Sole meunière du marché",prix:"28€"}]}], offers:[{titre:"Formule ardoise",desc:"Plat du jour + verre de vin de propriétaire",prix:"19€",validite:"Mar–Sam midi",emoji:"🥩"}], events:[{titre:"Dégustation vins de propriétaires",date:"Mar 11 Fév",desc:"Rencontrez trois vignerons autour de leurs cuvées. 6 vins proposés.",emoji:"🍾",places:25}], avis:[{auteur:"François M.",note:4,date:"Jan 2025",texte:"Un vrai bistrot parisien comme on n'en fait plus. Cuisine honnête et patron sympa.",verifie:true}] },
  { id:5, categorie:"restaurant", name:"Cevicheria Lima", type:"Péruvien", arrondissement:"75009", ambiance:"Festif", note:4.7, tempsRoute:22, adresse:"18 Rue Condorcet, Paris 75009", tel:"01 53 21 XX XX", priceRange:"€€€", tags:["Ceviche","Fusion nikkei","Pisco"], premium:false, places:50, description:"La cuisine péruvienne dans toute sa splendeur. Ceviche dressé à la minute, tiradito, causas et cocktails au pisco qui font voyager.", coords:{lat:48.8777,lng:2.3451}, schedule:[{days:[1,2,3,4,5,6],open:"12:30",close:"15:00"},{days:[1,2,3,4,5,6],open:"19:00",close:"23:30"}], social:{instagram:"@cevicheria_lima",facebook:"CevicheriaLimaParis",tiktok:"@cevicherialima"}, menu:[{cat:"Ceviches",items:[{nom:"Ceviche clásico (daurade, citron vert)",prix:"18€"},{nom:"Ceviche nikkei (saumon, soja, yuzu)",prix:"21€"},{nom:"Tiradito de Saint-Jacques",prix:"22€"}]},{cat:"Plats",items:[{nom:"Lomo saltado wagyu",prix:"28€"},{nom:"Causa limeña au crabe",prix:"19€"}]},{cat:"Cocktails",items:[{nom:"Pisco Sour maison",prix:"12€"},{nom:"Chicha Morada",prix:"8€"}]}], offers:[{titre:"Happy Pisco",desc:"2 Pisco Sour = 1 offert + ceviche amuse-bouche",prix:"Offre",validite:"Mar–Sam 18h–20h",emoji:"🍋"}], events:[{titre:"Nuit péruvienne Saint-Valentin",date:"Ven 14 Fév",desc:"Menu dégustation 7 services, cocktails pisco et musique live.",emoji:"🫙",places:30}], avis:[{auteur:"Camille D.",note:5,date:"Fév 2025",texte:"Le ceviche nikkei est une révélation. Cocktails au pisco les meilleurs de Paris !",verifie:true}] },
  { id:6, categorie:"bar", name:"Le Comptoir Sauvage", type:"Bar à vins", arrondissement:"75011", ambiance:"Décontracté", note:4.7, tempsRoute:10, adresse:"34 Rue Oberkampf, Paris 75011", tel:"01 43 57 XX XX", priceRange:"€€", tags:["Vins naturels","Tapas","Live music"], premium:true, places:30, description:"Une cave à vins naturels où chaque bouteille raconte une histoire. L'ardoise de tapas change chaque soir selon les arrivages.", coords:{lat:48.8651,lng:2.3741}, schedule:[{days:[0,1,2,3,4,5,6],open:"17:00",close:"02:00"}], social:{instagram:"@lecomptoirsauvage",facebook:"ComptoirSauvage11",tiktok:"@comptoirsauvage"}, menu:[{cat:"Vins au verre",items:[{nom:"Blanc naturel — Domaine Mosse",prix:"7€"},{nom:"Rouge biodynamique — La Sorga",prix:"8€"},{nom:"Pétillant naturel — Binner",prix:"9€"}]},{cat:"Tapas",items:[{nom:"Planche charcuterie artisanale",prix:"14€"},{nom:"Fromages affinés sélection",prix:"12€"}]}], offers:[{titre:"Happy Vins",desc:"Toutes les bouteilles -20% + planche offerte dès 2 bouteilles",prix:"-20%",validite:"Lun–Mer dès 17h",emoji:"🍷"}], events:[{titre:"Live Jazz & Vins naturels",date:"Jeu 13 Fév",desc:"Trio jazz manouche en live dès 21h. Sélection vins oranges et pétillants.",emoji:"🎸",places:30}], avis:[{auteur:"Alexis V.",note:5,date:"Jan 2025",texte:"Meilleure sélection de vins naturels de Paris. Personnel passionné.",verifie:true}] },
  { id:7, categorie:"bar", name:"Ciel de Paris Rooftop", type:"Bar lounge", arrondissement:"75015", ambiance:"Rooftop", note:4.6, tempsRoute:20, adresse:"Tour Montparnasse, Paris 75015", tel:"01 40 64 XX XX", priceRange:"€€€€", tags:["Rooftop","Cocktails","Vue panoramique"], premium:true, places:80, description:"Au 56e étage de la Tour Montparnasse, vue à 360° sur Paris. Cocktails signatures, champagne et DJ sets le week-end.", coords:{lat:48.8424,lng:2.3221}, schedule:[{days:[1,2,3,4,5,6],open:"18:00",close:"01:00"}], social:{instagram:"@cieldeparis_rooftop",facebook:"CielDeParis",tiktok:""}, menu:[{cat:"Cocktails signature",items:[{nom:"Paris Skyline (gin, violette, champagne)",prix:"18€"},{nom:"Tour Noire (rhum, café, cardamome)",prix:"16€"},{nom:"Seine Sunset (vodka, pêche, gingembre)",prix:"15€"}]},{cat:"Champagnes",items:[{nom:"Coupe Veuve Clicquot",prix:"22€"},{nom:"Flûte Ruinart Blanc de Blancs",prix:"28€"}]}], offers:[{titre:"Sunset Cocktail",desc:"Cocktail signature + coupe de champagne à l'heure dorée",prix:"28€",validite:"Tlj 18h–20h",emoji:"🌆"}], events:[{titre:"DJ Set Deep House Sunset",date:"Sam 8 Fév",desc:"Soirée DJ sur le rooftop avec vue sur Paris illuminée. Dress code élégant.",emoji:"✨",places:80},{titre:"Saint-Valentin au sommet",date:"Ven 14 Fév",desc:"Soirée privée en duo. Champagne, cocktails et Paris à vos pieds.",emoji:"💫",places:40}], avis:[{auteur:"Nadia K.",note:5,date:"Jan 2025",texte:"Vue à couper le souffle. Cocktails excellents, ambiance parfaite.",verifie:true}] },
  { id:8, categorie:"bar", name:"Le Speakeasy 1920", type:"Bar à cocktails", arrondissement:"75002", ambiance:"Vintage", note:4.8, tempsRoute:14, adresse:"12 Passage des Panoramas, Paris 75002", tel:"01 40 26 XX XX", priceRange:"€€€", tags:["Cocktails signature","Jazz","Prohibition"], premium:false, places:25, description:"Caché derrière une librairie, ce speakeasy vous plonge dans le Paris des années folles. Cocktails maison, jazz live et ambiance feutrée.", coords:{lat:48.8686,lng:2.3461}, schedule:[{days:[1,2,3,4,5],open:"19:00",close:"02:00"}], social:{instagram:"@speakeasy1920paris",facebook:"Speakeasy1920",tiktok:"@speakeasy.1920"}, menu:[{cat:"Cocktails 1920",items:[{nom:"Old Fashioned Prohibition",prix:"14€"},{nom:"Bee's Knees (gin, miel, citron)",prix:"13€"},{nom:"French 75 classique",prix:"15€"}]},{cat:"Spiritueux",items:[{nom:"Bourbon sélection (au verre)",prix:"12–22€"},{nom:"Rhum vieux (au verre)",prix:"10–18€"}]}], offers:[{titre:"Premier verre offert",desc:"Sur présentation de votre profil L'Adresse",prix:"Offert",validite:"Mar–Jeu",emoji:"🥃"}], events:[{titre:"Soirée Jazz Manouche",date:"Mar 4 Fév",desc:"Trio live inspiré de Django Reinhardt. Ambiance années 20.",emoji:"🎷",places:25},{titre:"Masterclass Cocktails 1920",date:"Sam 22 Fév",desc:"Préparez 3 cocktails iconiques des années folles avec notre barman en chef.",emoji:"🕰️",places:12}], avis:[{auteur:"Gabriel P.",note:5,date:"Fév 2025",texte:"Lieu magique ! On se croirait vraiment dans les années 20. Cocktails parfaitement exécutés.",verifie:true}] },
  { id:9, categorie:"bar", name:"La Mousse d'Or", type:"Bar à bières", arrondissement:"75005", ambiance:"Convivial", note:4.4, tempsRoute:7, adresse:"8 Rue Mouffetard, Paris 75005", tel:"01 43 31 XX XX", priceRange:"€", tags:["Bières artisanales","Terrasse","Planches"], premium:true, places:45, description:"50 bières artisanales au menu, 12 à la pression changeant chaque semaine. La terrasse sur la Mouffetard est l'une des plus animées du quartier Latin.", coords:{lat:48.8513,lng:2.3511}, schedule:[{days:[0,1,2,3,4,5,6],open:"15:00",close:"00:00"}], social:{instagram:"@lamousse_dor",facebook:"LaMousseDorParis",tiktok:"@lamousse.dor"}, menu:[{cat:"Bières pression",items:[{nom:"IPA du moment — brasserie locale",prix:"6€"},{nom:"Stout irlandais artisanal",prix:"6.5€"},{nom:"Blanche belge",prix:"5.5€"}]},{cat:"Planches",items:[{nom:"Planche fromages affinés",prix:"12€"},{nom:"Planche charcuterie artisanale",prix:"13€"}]}], offers:[{titre:"Happy Mousse",desc:"Pinte achetée = mini planche offerte",prix:"Happy Hour",validite:"Lun–Ven 15h–18h",emoji:"🍺"}], events:[{titre:"Quiz bières du monde",date:"Mer 5 Fév",desc:"Testez vos connaissances. 3 équipes, 3 prix, dégustation incluse.",emoji:"🌍",places:30}], avis:[{auteur:"Kevin B.",note:4,date:"Jan 2025",texte:"Sélection impressionnante. Personnel passionné et de bons conseils.",verifie:true},{auteur:"Emilie S.",note:5,date:"Déc 2024",texte:"La terrasse en été c'est incroyable. Et les planches sont généreuses !",verifie:true}] }
];

const COLLECTIONS = [
  { id:"romantique", titre:"Soirées romantiques", emoji:"🕯️", desc:"Les adresses idéales pour une soirée en amoureux", ids:[1,7,8] },
  { id:"brunch",     titre:"Meilleurs brunchs",   emoji:"🥐", desc:"Déjeunez tard et bien le week-end",              ids:[3,4,9] },
  { id:"rooftop",    titre:"Rooftops & terrasses", emoji:"🌆", desc:"Paris à vos pieds, verre à la main",             ids:[7,6,9] },
  { id:"gastronomie",titre:"Gastronomie fine",     emoji:"⭐", desc:"Les tables d'exception de la capitale",          ids:[1,2,5] },
  { id:"bars",       titre:"Bars incontournables", emoji:"🍸", desc:"Les meilleurs bars parisiens du moment",         ids:[6,7,8,9] },
  { id:"week",       titre:"Cette semaine",         emoji:"📅", desc:"Événements et soirées spéciales à ne pas rater", ids:[2,6,7,8] },
];

const TYPES_RESTAURANT = ["Tous","Français","Japonais","Italien","Espagnol","Mexicain","Péruvien","Thaïlandais","Libanais","Grec","Indien","Chinois","Américain","Brasserie","Bistrot","Autre"];
const TYPES_BAR        = ["Tous","Bar à vins","Bar lounge","Bar à cocktails","Bar à bières","Rooftop bar","Speakeasy","Bar à champagne","Cave à vins","Autre"];const ARRONDISSEMENTS  = ["Tous","75001","75002","75003","75004","75005","75006","75007","75008","75009","75010","75011","75012","75013","75014","75015","75016","75017","75018","75019","75020"];
const AMBIANCES_RESTO  = ["Toutes","Romantique","Zen","Convivial","Authentique","Festif"];
const AMBIANCES_BAR    = ["Toutes","Décontracté","Rooftop","Vintage","Convivial","Festif"];


const Logo = ({ light }) => (
  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
    <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#C8914A,#E8C882)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:700, color:"#1A0A00", boxShadow:"0 2px 10px rgba(200,145,74,0.4)" }}>A</div>
    <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:700, color:light?"#FFF":"#1A0A00", letterSpacing:"0.04em" }}>L'<span style={{ color:"#C8914A" }}>Adresse</span></span>
  </div>
);

const Stars = ({ note, size }) => (
  <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:size||13 }}>
    {[1,2,3,4,5].map(i => <span key={i} style={{ color:i<=Math.round(note)?"#C8914A":"#DDD" }}>★</span>)}
    <span style={{ color:"#888", marginLeft:3, fontWeight:600 }}>{note.toFixed(1)}</span>
  </span>
);

const OpenBadge = ({ schedule, small, overlay }) => {
  const s = getStatusLabel(schedule);
  if (overlay) return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)", color:s.open?"#81C784":"#EF9A9A", fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.open?"#43A047":"#E53935" }} />{s.label}
    </span>
  );
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:s.open?"rgba(56,142,60,0.1)":"rgba(180,60,50,0.08)", color:s.open?"#2E7D32":"#B71C1C", padding:small?"2px 8px":"4px 10px", borderRadius:20, fontSize:small?11:12, fontWeight:700, border:`1px solid ${s.open?"rgba(56,142,60,0.22)":"rgba(180,60,50,0.18)"}` }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.open?"#43A047":"#E53935" }} />{s.label}
    </span>
  );
};

const IgIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>;
const FbIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
const TkIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.54V6.78a4.85 4.85 0 0 1-1.06-.09z"/></svg>;

const SocialLinks = ({ social, light }) => {
  if (!social) return null;
  const items = [
    social.instagram && { Icon:IgIcon, handle:social.instagram, url:`https://instagram.com/${social.instagram.replace("@","")}` },
    social.facebook  && { Icon:FbIcon, handle:social.facebook,  url:`https://facebook.com/${social.facebook}` },
    social.tiktok    && { Icon:TkIcon, handle:social.tiktok,    url:`https://tiktok.com/${social.tiktok}` },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      {items.map(({ Icon, handle, url }) => (
        <a key={handle} href={url} target="_blank" rel="noopener noreferrer"
          style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 11px", borderRadius:20, background:light?"rgba(255,255,255,0.1)":"#F5F2EE", border:`1px solid ${light?"rgba(255,255,255,0.18)":"#EDE8E0"}`, textDecoration:"none", color:light?"#FFF":"#444", fontSize:12, fontWeight:600 }}>
          <Icon />{handle}
        </a>
      ))}
    </div>
  );
};

const Gallery = ({ id }) => {
  const [cur, setCur] = useState(0);
  const ps = PHOTOS[id] || [];
  if (!ps.length) return null;
  return (
    <div>
      <div style={{ width:"100%", height:220, borderRadius:14, overflow:"hidden", position:"relative", background:"#E8E0D0" }}>
        <img src={ps[cur]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => e.target.style.display="none"} />
        {ps.length > 1 && <>
          <button onClick={() => setCur(c => (c-1+ps.length)%ps.length)} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.5)", color:"#FFF", border:"none", borderRadius:"50%", width:32, height:32, fontSize:16, cursor:"pointer" }}>‹</button>
          <button onClick={() => setCur(c => (c+1)%ps.length)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.5)", color:"#FFF", border:"none", borderRadius:"50%", width:32, height:32, fontSize:16, cursor:"pointer" }}>›</button>
        </>}
      </div>
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        {ps.map((p,i) => (
          <div key={i} onClick={() => setCur(i)} style={{ flex:1, height:58, borderRadius:10, overflow:"hidden", cursor:"pointer", opacity:i===cur?1:0.5, border:i===cur?"2px solid #C8914A":"2px solid transparent" }}>
            <img src={p} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => e.target.parentElement.style.display="none"} />
          </div>
        ))}
      </div>
    </div>
  );
};

const Toast = ({ msg, onHide }) => {
  useEffect(() => { const t = setTimeout(onHide, 2800); return () => clearTimeout(t); }, [onHide]);
  return <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"#1A0A00", color:"#E8C882", padding:"10px 22px", borderRadius:30, fontSize:13, fontWeight:700, zIndex:2000, boxShadow:"0 4px 20px rgba(0,0,0,0.3)", pointerEvents:"none", whiteSpace:"nowrap" }}>{msg}</div>;
};

const FilterPill = ({ label, options, value, onChange, isObj }) => {
  const defVal = isObj ? options[0]?.value : options[0];
  const isActive = value !== defVal;
  const display = isObj ? (options.find(o => o.value===value)?.label || label) : (isActive ? value : label);
  return (
    <div style={{ position:"relative" }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ appearance:"none", WebkitAppearance:"none", display:"flex", alignItems:"center", padding:"8px 28px 8px 14px", borderRadius:30, border:`1.5px solid ${isActive?"#C8914A":"#DDD"}`, background:isActive?"#FBF0E8":"#FFF", color:isActive?"#C8914A":"#666", fontSize:13, fontWeight:isActive?700:500, cursor:"pointer", fontFamily:"'Lato',sans-serif", whiteSpace:"nowrap", outline:"none" }}>
        <option value={defVal}>{label}</option>
        {options.map(o => {
          const val=isObj?o.value:o, lbl=isObj?o.label:o;
          return <option key={val} value={val}>{lbl}</option>;
        })}
      </select>
      <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:9, color:isActive?"#C8914A":"#666", pointerEvents:"none" }}>▼</span>
    </div>
  );
};

const HorairesFilter = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const OPTS = [
    { k:"tous",     label:"🕐 Horaires" },
    { k:"open_now", label:"Ouvert maintenant", dot:true },
    { k:"lunch",    label:"Déjeuner (11h–15h)" },
    { k:"dinner",   label:"Dîner (18h–23h)" },
    { k:"late",     label:"Tard le soir (23h–02h)" },
  ];
  const cur = OPTS.find(o => o.k===value) || OPTS[0];
  const isActive = value !== "tous";
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:30, border:`1.5px solid ${isActive?"#C8914A":"#DDD"}`, background:isActive?"#FBF0E8":"#FFF", color:isActive?"#C8914A":"#666", fontSize:13, fontWeight:isActive?700:500, cursor:"pointer", fontFamily:"'Lato',sans-serif", whiteSpace:"nowrap" }}>
        {value==="open_now" && <span style={{ width:7, height:7, borderRadius:"50%", background:"#43A047" }} />}
        {cur.label}<span style={{ fontSize:9, opacity:0.5 }}>▼</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, background:"#FFF", borderRadius:14, padding:6, boxShadow:"0 8px 32px rgba(0,0,0,0.14)", zIndex:300, minWidth:220, border:"1px solid #F0EDE8", maxHeight:220, overflowY:"auto" }}>
          {OPTS.map(o => (
            <button key={o.k} onClick={() => { onChange(o.k); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", textAlign:"left", padding:"9px 12px", border:"none", borderRadius:8, background:value===o.k?"#FBF0E8":"none", color:value===o.k?"#C8914A":"#444", fontWeight:value===o.k?700:400, fontSize:13, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>
              {o.dot && <span style={{ width:7, height:7, borderRadius:"50%", background:"#43A047", flexShrink:0 }} />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PriceFilter = ({ value, onChange }) => (
  <div style={{ display:"flex", alignItems:"center", gap:4, background:"#FFF", border:"1.5px solid #DDD", borderRadius:30, padding:"5px 12px" }}>
    <span style={{ fontSize:11, color:"#AAA", fontWeight:600, marginRight:2, whiteSpace:"nowrap" }}>Budget</span>
    {["€","€€","€€€","€€€€"].map(p => (
      <button key={p} onClick={() => onChange(value===p?"Tous":p)} style={{ padding:"3px 8px", borderRadius:16, border:"none", background:value===p?"#C8914A":"transparent", color:value===p?"#FFF":"#999", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{p}</button>
    ))}
  </div>
);

const SurpriseModal = ({ onClose, onOpen }) => {
  const [step, setStep] = useState("form");
  const [pref, setPref] = useState({ categorie:"tous", budget:"Tous", arr:"Tous" });
  const [result, setResult] = useState(null);
  useEscapeKey(onClose);
  const launch = () => {
    const pool = LIEUX.filter(l => {
      if (pref.categorie!=="tous" && l.categorie!==pref.categorie) return false;
      if (pref.budget!=="Tous" && l.priceRange!==pref.budget) return false;
      if (pref.arr!=="Tous" && l.arrondissement!==pref.arr) return false;
      return true;
    });
    if (!pool.length) { alert("Aucun résultat, élargissez vos critères !"); return; }
    setStep("spinning");
    setTimeout(() => { setResult(pool[Math.floor(Math.random()*pool.length)]); setStep("result"); }, 1800);
  };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth:440, textAlign:"center" }} onClick={e => e.stopPropagation()}>
        <button style={S.closeBtn} onClick={onClose}>✕</button>
        {step==="form" && <>
          <div style={{ fontSize:52, marginBottom:10 }}>🎲</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", margin:"0 0 6px", fontSize:26 }}>L'Adresse Surprise</h2>
          <p style={{ color:"#888", fontSize:14, margin:"0 0 22px" }}>Dites-nous juste l'essentiel, on s'occupe du reste.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:12, textAlign:"left", marginBottom:20 }}>
            <div>
              <label style={S.label}>Je cherche un…</label>
              <div style={{ display:"flex", gap:8 }}>
                {[["tous","🌟 Peu importe"],["restaurant","🍽 Restaurant"],["bar","🍸 Bar"]].map(([k,l]) => (
                  <button key={k} onClick={() => setPref(p => ({...p, categorie:k}))} style={{ flex:1, padding:"8px 4px", borderRadius:12, border:"1.5px solid", borderColor:pref.categorie===k?"#C8914A":"#E0D8CF", background:pref.categorie===k?"#FBF0E8":"#FFF", color:pref.categorie===k?"#C8914A":"#777", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={S.label}>Budget</label>
              <div style={{ display:"flex", gap:8 }}>
                {["Tous","€","€€","€€€","€€€€"].map(p => (
                  <button key={p} onClick={() => setPref(f => ({...f, budget:p}))} style={{ flex:1, padding:"8px 4px", borderRadius:12, border:"1.5px solid", borderColor:pref.budget===p?"#C8914A":"#E0D8CF", background:pref.budget===p?"#FBF0E8":"#FFF", color:pref.budget===p?"#C8914A":"#777", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={S.label}>Arrondissement</label>
              <select style={S.input} value={pref.arr} onChange={e => setPref(p => ({...p, arr:e.target.value}))}>
                {ARRONDISSEMENTS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <button onClick={launch} style={{ ...S.btnPrimary, width:"100%", padding:"13px", fontSize:15 }}>🎲 Surprends-moi !</button>
        </>}
        {step==="spinning" && <>
          <div style={{ fontSize:60, marginBottom:16 }}>🎲</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", fontSize:22 }}>On cherche votre adresse…</h2>
          <p style={{ color:"#AAA", fontSize:14 }}>Parmi {LIEUX.length} établissements sélectionnés</p>
        </>}
        {step==="result" && result && <>
          <div style={{ fontSize:42, marginBottom:8 }}>🎉</div>
          <p style={{ color:"#C8914A", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", margin:"0 0 4px" }}>Votre adresse surprise</p>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", margin:"0 0 4px", fontSize:26 }}>{result.name}</h2>
          <p style={{ color:"#888", fontSize:13, margin:"0 0 12px" }}>{result.type} · {result.arrondissement}</p>
          <div style={{ width:"100%", height:130, borderRadius:14, overflow:"hidden", marginBottom:12 }}>
            <img src={PHOTOS[result.id]?.[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          </div>
          <p style={{ color:"#666", fontSize:13, lineHeight:1.6, margin:"0 0 14px" }}>{result.description}</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", marginBottom:14 }}>
            <Stars note={result.note} /><OpenBadge schedule={result.schedule} small />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => { onClose(); onOpen(result); }} style={{ ...S.btnPrimary, flex:1 }}>Voir la fiche →</button>
            <button onClick={() => { setStep("form"); setResult(null); }} style={{ ...S.btnOutline, flex:1 }}>🎲 Rejouer</button>
          </div>
        </>}
      </div>
    </div>
  );
};

const AuthModal = ({ mode, onClose, onAuth }) => {
  const [tab, setTab] = useState(mode);
  const [form, setForm] = useState({ email:"", password:"", nom:"", etablissement:"", siret:"" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const up = f => setForm(p => ({...p, ...f}));
  useEscapeKey(onClose);

  const submit = async () => {
    setErr(""); setLoading(true);
    if (!form.email || !form.password) { setLoading(false); return setErr("Veuillez remplir tous les champs obligatoires."); }
    if (!form.email.includes("@")) { setLoading(false); return setErr("Adresse email invalide."); }

    try {
      if (tab === "login") {
        // ── Connexion Supabase ──
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) { setLoading(false); return setErr("Email ou mot de passe incorrect."); }

        // Récupérer le profil depuis la table profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        onAuth({ ...data.user, ...profile });
        onClose();

      } else {
        // ── Inscription Supabase ──
        if (!form.nom.trim()) { setLoading(false); return setErr("Veuillez entrer votre nom complet."); }
        if (form.password.length < 6) { setLoading(false); return setErr("Mot de passe trop court (min. 6 caractères)."); }
        if (tab === "pro" && !form.etablissement.trim()) { setLoading(false); return setErr("Veuillez entrer le nom de votre établissement."); }

        // Créer le compte auth
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: {
              nom: form.nom.trim(),
              role: tab === "pro" ? "pro" : "user",
              etablissement: form.etablissement || null,
            }
          }
        });
        if (error) { setLoading(false); return setErr(error.message); }

        // Créer le profil dans la table profiles
        await supabase.from("profiles").insert({
          id: data.user.id,
          nom: form.nom.trim(),
          email: form.email.trim(),
          role: tab === "pro" ? "pro" : "user",
          etablissement: form.etablissement || null,
          siret: form.siret || null,
          onboarded: tab !== "pro",
        });

        onAuth({
          ...data.user,
          nom: form.nom.trim(),
          role: tab === "pro" ? "pro" : "user",
          etablissement: form.etablissement || null,
          onboarded: tab !== "pro",
        });
        onClose();
      }
    } catch (e) {
      setErr("Une erreur est survenue. Réessayez.");
    }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth:430 }} onClick={e => e.stopPropagation()}>
        <button style={S.closeBtn} onClick={onClose}>✕</button>
        <div style={{ textAlign:"center", marginBottom:18 }}>
          <Logo /><p style={{ margin:"8px 0 0", color:"#999", fontSize:13 }}>{tab==="login"?"Bon retour !":"Rejoignez la communauté"}</p>
        </div>
        <div style={{ display:"flex", background:"#F5F2EE", borderRadius:12, padding:4, marginBottom:18 }}>
          {[["user","👤 Utilisateur"],["pro","🏪 Professionnel"],["login","🔑 Connexion"]].map(([k,l]) => (
            <button key={k} onClick={() => { setTab(k); setErr(""); }} style={{ flex:1, padding:"8px 4px", border:"none", borderRadius:9, background:tab===k?"#FFF":"transparent", fontWeight:700, fontSize:12, cursor:"pointer", color:tab===k?"#C8914A":"#888", fontFamily:"'Lato',sans-serif" }}>{l}</button>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {tab!=="login" && <input style={S.input} placeholder="Nom complet *" value={form.nom} onChange={e => up({nom:e.target.value})} />}
          <input style={S.input} placeholder="Adresse email *" type="email" value={form.email} onChange={e => up({email:e.target.value})} />
          <input style={S.input} placeholder="Mot de passe * (min. 6 caractères)" type="password" value={form.password} onChange={e => up({password:e.target.value})} onKeyDown={e => e.key==="Enter" && submit()} />
          {tab==="pro" && <>
            <input style={S.input} placeholder="Nom de l'établissement *" value={form.etablissement} onChange={e => up({etablissement:e.target.value})} />
            <input style={S.input} placeholder="N° SIRET (optionnel)" value={form.siret} onChange={e => up({siret:e.target.value})} />
            <div style={{ background:"linear-gradient(135deg,#FBF0E8,#FFF5EC)", borderRadius:12, padding:"13px 15px", border:"1px solid #F0D5B0" }}>
              <div style={{ fontWeight:800, color:"#C8914A", fontSize:15, marginBottom:3 }}>✦ Offre Pro — 29€/mois</div>
              <div style={{ fontSize:12, color:"#7B5800", lineHeight:1.7 }}>✓ Fiche complète · ✓ Menu en ligne · ✓ Offres exclusives<br/>✓ Événements · ✓ Avis vérifiés · ✓ Badge Premium</div>
            </div>
          </>}
          {err && <div style={{ background:"#FFF0F0", border:"1px solid #FFCDD2", borderRadius:10, padding:"9px 13px", fontSize:13, color:"#C62828", fontWeight:600 }}>⚠️ {err}</div>}
          <button onClick={submit} disabled={loading} style={{ ...S.btnPrimary, marginTop:2, opacity:loading?0.7:1 }}>
            {loading ? "⏳ Chargement…" : tab==="login" ? "Se connecter →" : tab==="pro" ? "Créer mon compte Pro →" : "Créer mon compte →"}
          </button>
          <p style={{ fontSize:11, color:"#CCC", textAlign:"center", margin:0 }}>En continuant, vous acceptez les CGU de L'Adresse</p>
        </div>
      </div>
    </div>
  );
};

const PhotosOnboarding = ({ photos, onChange }) => {
  const fileRef = useRef();
  const addPhotos = (e) => { const files = Array.from(e.target.files); onChange([...photos, ...files.map(f => URL.createObjectURL(f))].slice(0,6)); e.target.value=""; };
  const remove = (i) => onChange(photos.filter((_,idx) => idx!==i));
  const moveFirst = (i) => { const arr=[...photos]; const [item]=arr.splice(i,1); arr.unshift(item); onChange(arr); };
  return (
    <div>
      <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", fontSize:26, margin:"0 0 4px" }}>📸 Photos de l'établissement</h2>
      <p style={{ color:"#999", fontSize:14, margin:"0 0 6px" }}>Jusqu'à 6 photos. La 1ère sera votre <strong style={{color:"#C8914A"}}>photo de couverture</strong>.</p>
      <p style={{ color:"#BBB", fontSize:12, margin:"0 0 20px" }}>Les photos augmentent les clics de +67% · JPG, PNG · 5 Mo max</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        {photos.map((src,i) => (
          <div key={i} style={{ position:"relative", aspectRatio:"1", borderRadius:12, overflow:"hidden", border:i===0?"2px solid #C8914A":"2px solid #EDE8E0" }}>
            <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            {i===0 && <span style={{ position:"absolute", top:6, left:6, background:"#C8914A", color:"#FFF", fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:8 }}>COVER</span>}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent,rgba(0,0,0,0.65))", padding:"18px 6px 6px", display:"flex", gap:4, justifyContent:"center" }}>
              {i!==0 && <button onClick={() => moveFirst(i)} style={{ background:"rgba(200,145,74,0.9)", border:"none", color:"#FFF", borderRadius:6, padding:"3px 7px", fontSize:10, cursor:"pointer", fontFamily:"'Lato',sans-serif", fontWeight:700 }}>⭐ Cover</button>}
              <button onClick={() => remove(i)} style={{ background:"rgba(185,28,28,0.85)", border:"none", color:"#FFF", borderRadius:6, padding:"3px 7px", fontSize:10, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>✕</button>
            </div>
          </div>
        ))}
        {photos.length<6 && (
          <div onClick={() => fileRef.current.click()} style={{ aspectRatio:"1", borderRadius:12, border:"2px dashed #C8B89A", background:"#FBF8F4", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, cursor:"pointer" }}>
            <span style={{ fontSize:28 }}>📷</span>
            <span style={{ fontSize:12, color:"#AAA", fontWeight:600 }}>Ajouter</span>
            <span style={{ fontSize:10, color:"#CCC" }}>{photos.length}/6</span>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={addPhotos} />
      {photos.length===0 && <button onClick={() => fileRef.current.click()} style={{ width:"100%", padding:"16px", background:"linear-gradient(135deg,#FBF0E8,#FFF5EC)", border:"2px dashed #C8914A", borderRadius:14, color:"#C8914A", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>+ Choisir mes photos</button>}
      <div style={{ background:"#F9F7F4", borderRadius:12, padding:"12px 16px", marginTop:14, border:"1px solid #EDE8E0" }}>
        <div style={{ fontSize:12, color:"#888", lineHeight:1.7 }}>💡 <strong>Conseils :</strong> Privilégiez des photos de salle lumineuses, vos plats phares et la façade.</div>
      </div>
    </div>
  );
};

const OnboardingPro = ({ user, onDone }) => {
  const isMobile = useIsMobile();
  const [step, setStep] = useState(1);
  const [fiche, setFiche] = useState({ categorie:"restaurant", name:user.etablissement||"", type:"", adresse:"", arrondissement:"", tel:"", description:"", places:"", priceRange:"€€", ambiance:"", instagram:"", facebook:"", tiktok:"", lun:false, mar:true, mer:true, jeu:true, ven:true, sam:true, dim:false, openMidi:"12:00", closeMidi:"14:30", openSoir:"19:00", closeSoir:"22:30", hasMidi:true, hasSoir:true, photos:[] });
  const up = f => setFiche(p => ({...p, ...f}));
  const TYPES_R=["Français","Japonais","Italien","Espagnol","Mexicain","Péruvien","Thaïlandais","Libanais","Grec","Indien","Autre"];
  const TYPES_B=["Bar à vins","Bar à cocktails","Bar à bières","Bar lounge","Rooftop bar","Speakeasy","Autre"];
  const AMBIANCES_R=["Romantique","Zen","Convivial","Authentique","Festif","Familial","Branché"];
  const AMBIANCES_B=["Décontracté","Rooftop","Vintage","Convivial","Festif","Chic","Branché"];
  const ARRS=["75001","75002","75003","75004","75005","75006","75007","75008","75009","75010","75011","75012","75013","75014","75015","75016","75017","75018","75019","75020"];
  const JOURS=[["lun","L"],["mar","M"],["mer","M"],["jeu","J"],["ven","V"],["sam","S"],["dim","D"]];
  const progress = Math.round((step/5)*100);
  const inp = { ...S.input, marginTop:4 };
  const lbl = { display:"block", fontSize:11, color:"#AAA", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginTop:12, marginBottom:4 };
  const toggle = (on) => ({ width:44, height:24, borderRadius:12, background:on?"#C8914A":"#DDD", border:"none", cursor:"pointer", position:"relative", transition:"background .2s" });
  const nextStep = () => {
    if (step===1 && (!fiche.name||!fiche.type||!fiche.adresse||!fiche.arrondissement||!fiche.tel||!fiche.ambiance||!fiche.description)) return alert("Veuillez remplir tous les champs obligatoires (*)");
    setStep(s=>s+1);
  };
  return (
    <div style={{ minHeight:"100vh", background:"#F5F2EE", fontFamily:"'Lato',sans-serif" }}>
      <div style={{ background:"#12080A", padding:"0 16px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Logo light /><span style={{ color:"#E8C882", fontSize:13, fontWeight:600 }}>✦ Configuration de votre fiche</span>
      </div>
      <div style={{ maxWidth:660, margin:"0 auto", padding:isMobile?"16px 14px 32px":"32px 20px 60px" }}>
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:13, color:"#AAA" }}>Étape {step} / 5</span>
            <span style={{ fontSize:13, fontWeight:700, color:"#C8914A" }}>{progress}% complété</span>
          </div>
          <div style={{ height:6, background:"#E8E0D0", borderRadius:10, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${progress}%`, background:"linear-gradient(90deg,#C8914A,#E8C882)", borderRadius:10, transition:"width .4s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, overflowX:"auto" }}>
            {["Établissement","Horaires","Réseaux","Photos","Confirmation"].map((s,i) => (
              <span key={s} style={{ fontSize:11, color:step>i+1?"#C8914A":step===i+1?"#1A0A00":"#CCC", fontWeight:step>=i+1?700:400 }}>{step>i+1?"✓ ":""}{s}</span>
            ))}
          </div>
        </div>
        <div style={{ background:"#FFF", borderRadius:isMobile?16:24, padding:isMobile?"20px 18px":"28px 32px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
          {step===1 && (
            <div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", fontSize:26, margin:"0 0 4px" }}>Votre établissement</h2>
              <p style={{ color:"#999", fontSize:14, margin:"0 0 20px" }}>Ces informations apparaîtront sur votre fiche publique.</p>
              <label style={lbl}>Type d'établissement *</label>
              <div style={{ display:"flex", gap:10, marginBottom:4 }}>
                {[["restaurant","🍽 Restaurant"],["bar","🍸 Bar"]].map(([k,l]) => (
                  <button key={k} onClick={() => up({categorie:k,type:"",ambiance:""})} style={{ flex:1, padding:"12px", borderRadius:14, border:"2px solid", borderColor:fiche.categorie===k?"#C8914A":"#E8E0D0", background:fiche.categorie===k?"#FBF0E8":"#FFF", color:fiche.categorie===k?"#C8914A":"#888", fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{l}</button>
                ))}
              </div>
              <label style={lbl}>Nom de l'établissement *</label>
              <input style={inp} placeholder="ex : Le Jardin Secret" value={fiche.name} onChange={e => up({name:e.target.value})} />
              <label style={lbl}>Cuisine / Type de bar *</label>
              <select style={inp} value={fiche.type} onChange={e => up({type:e.target.value})}>
                <option value="">Choisir…</option>
                {(fiche.categorie==="restaurant"?TYPES_R:TYPES_B).map(t => <option key={t}>{t}</option>)}
              </select>
              <label style={lbl}>Adresse complète *</label>
              <input style={inp} placeholder="ex : 12 Rue de Buci" value={fiche.adresse} onChange={e => up({adresse:e.target.value})} />
              <label style={lbl}>Arrondissement *</label>
              <select style={inp} value={fiche.arrondissement} onChange={e => up({arrondissement:e.target.value})}>
                <option value="">Choisir…</option>
                {ARRS.map(a => <option key={a}>{a}</option>)}
              </select>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><label style={lbl}>Téléphone *</label><input style={inp} placeholder="01 XX XX XX XX" value={fiche.tel} onChange={e => up({tel:e.target.value})} /></div>
                <div><label style={lbl}>Nombre de places</label><input style={inp} type="number" min="1" placeholder="ex : 40" value={fiche.places} onChange={e => up({places:e.target.value})} /></div>
              </div>
              <label style={lbl}>Budget moyen *</label>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                {["€","€€","€€€","€€€€"].map(p => (
                  <button key={p} onClick={() => up({priceRange:p})} style={{ flex:1, padding:"10px 4px", borderRadius:12, border:"2px solid", borderColor:fiche.priceRange===p?"#C8914A":"#E8E0D0", background:fiche.priceRange===p?"#FBF0E8":"#FFF", color:fiche.priceRange===p?"#C8914A":"#888", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{p}</button>
                ))}
              </div>
              <label style={lbl}>Ambiance *</label>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
                {(fiche.categorie==="restaurant"?AMBIANCES_R:AMBIANCES_B).map(a => (
                  <button key={a} onClick={() => up({ambiance:a})} style={{ padding:"7px 14px", borderRadius:20, border:"1.5px solid", borderColor:fiche.ambiance===a?"#C8914A":"#E8E0D0", background:fiche.ambiance===a?"#FBF0E8":"#FFF", color:fiche.ambiance===a?"#C8914A":"#888", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{a}</button>
                ))}
              </div>
              <label style={lbl}>Description *</label>
              <textarea style={{...inp,height:85,resize:"none"}} placeholder="Décrivez votre établissement en quelques phrases…" value={fiche.description} onChange={e => up({description:e.target.value})} />
            </div>
          )}
          {step===2 && (
            <div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", fontSize:26, margin:"0 0 4px" }}>Vos horaires</h2>
              <p style={{ color:"#999", fontSize:14, margin:"0 0 20px" }}>Indispensable pour afficher votre statut en temps réel.</p>
              <label style={lbl}>Jours d'ouverture</label>
              <div style={{ display:"flex", gap:8, marginTop:8, marginBottom:18 }}>
                {JOURS.map(([k,l]) => (
                  <button key={k} onClick={() => up({[k]:!fiche[k]})} style={{ width:40, height:40, borderRadius:12, border:"2px solid", borderColor:fiche[k]?"#C8914A":"#E8E0D0", background:fiche[k]?"#FBF0E8":"#FFF", color:fiche[k]?"#C8914A":"#BBB", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{l}</button>
                ))}
              </div>
              {[["Midi","🌞","hasMidi","openMidi","closeMidi","Déjeuner"],["Soir","🌙","hasSoir","openSoir","closeSoir","Dîner / Soirée"]].map(([n,ic,key,kO,kC,sub]) => (
                <div key={n} style={{ background:"#F9F7F4", borderRadius:16, padding:"16px 20px", marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:fiche[key]?14:0 }}>
                    <div><div style={{ fontWeight:700, color:"#1A0A00", fontSize:15 }}>{ic} Service du {n}</div><div style={{ fontSize:12, color:"#AAA" }}>{sub}</div></div>
                    <button onClick={() => up({[key]:!fiche[key]})} style={toggle(fiche[key])}>
                      <div style={{ position:"absolute", top:2, left:fiche[key]?22:2, width:20, height:20, borderRadius:"50%", background:"#FFF", transition:"left .2s" }} />
                    </button>
                  </div>
                  {fiche[key] && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      <div><label style={{ fontSize:11, color:"#AAA", display:"block", marginBottom:4 }}>Ouverture</label><input type="time" style={inp} value={fiche[kO]} onChange={e => up({[kO]:e.target.value})} /></div>
                      <div><label style={{ fontSize:11, color:"#AAA", display:"block", marginBottom:4 }}>Fermeture</label><input type="time" style={inp} value={fiche[kC]} onChange={e => up({[kC]:e.target.value})} /></div>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ background:"#FBF0E8", borderRadius:12, padding:"10px 14px", border:"1px solid #F0D5B0" }}>
                <div style={{ fontSize:12, color:"#7B5800" }}>💡 <strong>Aperçu :</strong> {JOURS.filter(([k])=>fiche[k]).map(([,l])=>l).join(" ")||"Aucun jour"}{fiche.hasMidi&&` · Midi ${fiche.openMidi}–${fiche.closeMidi}`}{fiche.hasSoir&&` · Soir ${fiche.openSoir}–${fiche.closeSoir}`}</div>
              </div>
            </div>
          )}
          {step===3 && (
            <div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", fontSize:26, margin:"0 0 4px" }}>Vos réseaux sociaux</h2>
              <p style={{ color:"#999", fontSize:14, margin:"0 0 20px" }}>Optionnel mais recommandé pour booster votre visibilité.</p>
              {[["instagram","📸 Instagram","@votre_compte"],["facebook","📘 Facebook","NomDeVotrePage"],["tiktok","🎵 TikTok","@votre_tiktok"]].map(([k,label,ph]) => (
                <div key={k}><label style={lbl}>{label}</label><input style={inp} placeholder={ph} value={fiche[k]} onChange={e => up({[k]:e.target.value})} /></div>
              ))}
              <div style={{ background:"#F9F7F4", borderRadius:14, padding:"14px 16px", marginTop:18, border:"1px solid #EDE8E0" }}>
                <div style={{ fontSize:13, color:"#888", lineHeight:1.6 }}>💡 Vos réseaux apparaîtront sur votre fiche avec des liens cliquables.</div>
              </div>
            </div>
          )}
          {step===4 && <PhotosOnboarding photos={fiche.photos||[]} onChange={photos => up({photos})} />}
          {step===5 && (
            <div>
              <div style={{ textAlign:"center", marginBottom:22 }}>
                <div style={{ fontSize:52, marginBottom:10 }}>🎉</div>
                <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", fontSize:26, margin:"0 0 6px" }}>Votre fiche est prête !</h2>
                <p style={{ color:"#888", fontSize:14 }}>Vérifiez les informations avant de publier.</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:18 }}>
                {[["🏪","Établissement",fiche.name||"—"],["📂","Catégorie",`${fiche.categorie==="restaurant"?"Restaurant":"Bar"} · ${fiche.type||"—"}`],["📍","Adresse",`${fiche.adresse||"—"}, ${fiche.arrondissement||"—"}`],["📞","Téléphone",fiche.tel||"—"],["💰","Budget",fiche.priceRange],["✨","Ambiance",fiche.ambiance||"—"],["🕐","Horaires",[fiche.hasMidi&&`Midi ${fiche.openMidi}–${fiche.closeMidi}`,fiche.hasSoir&&`Soir ${fiche.openSoir}–${fiche.closeSoir}`].filter(Boolean).join(" · ")||"—"],["📸","Photos",`${(fiche.photos||[]).length} photo(s) ajoutée(s)`],["📱","Instagram",fiche.instagram||"Non renseigné"]].map(([ic,k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"#F9F7F4", borderRadius:10 }}>
                    <span style={{ fontSize:13, color:"#AAA", fontWeight:600 }}>{ic} {k}</span>
                    <span style={{ fontSize:13, color:"#1A0A00", fontWeight:700, textAlign:"right", maxWidth:"55%" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:"linear-gradient(135deg,#FBF0E8,#FFF5EC)", borderRadius:14, padding:"14px 18px", border:"1px solid #F0D5B0", marginBottom:18 }}>
                <div style={{ fontWeight:800, color:"#C8914A", fontSize:14, marginBottom:3 }}>✦ Abonnement Premium — 29€/mois</div>
                <div style={{ fontSize:12, color:"#7B5800", lineHeight:1.7 }}>✓ Fiche visible immédiatement · ✓ Menu en ligne · ✓ Offres exclusives · ✓ Badge Premium</div>
              </div>
              <button onClick={() => onDone(fiche)} style={{ ...S.btnPrimary, width:"100%", padding:"14px", fontSize:15 }}>🚀 Publier ma fiche →</button>
            </div>
          )}
        </div>
        {step<5 && (
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:16 }}>
            {step>1 ? <button onClick={() => setStep(s=>s-1)} style={{ ...S.btnOutline, padding:"11px 24px" }}>← Retour</button> : <div />}
            <button onClick={nextStep} style={{ ...S.btnPrimary, padding:"11px 28px" }}>Étape suivante →</button>
          </div>
        )}
      </div>
    </div>
  );
};

const FicheModal = ({ lieu, user, onClose, onReserve, onAuthNeeded, onToast }) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("info");
  const [reviewForm, setReviewForm] = useState({ note:5, texte:"" });
  const [avis, setAvis] = useState(lieu.avis || []);
  const [reviewSent, setReviewSent] = useState(false);
  const isBar = lieu.categorie === "bar";
  useEscapeKey(onClose);
  const submitReview = async () => {
    if (!user) return onAuthNeeded();
    if (!reviewForm.texte.trim()) return;
    await supabase.from("avis").insert({
      etablissement_id: lieu.id,
      user_id: user.id,
      auteur: user.nom,
      note: reviewForm.note,
      texte: reviewForm.texte,
      verifie: true,
    });
    setAvis(a => [{ auteur:user.nom, note:reviewForm.note, date:"Maintenant", texte:reviewForm.texte, verifie:true }, ...a]);
    setReviewSent(true);
  };
  const TABS_D=[["info","📋 Infos"],["menu","🍽 Menu"],["offres","🔥 Offres"],["events","📅 Events"],["photos","📸 Photos"],["avis","⭐ Avis"],["map","🗺 Plan"],["reserve",isBar?"📞 Contact":"📅 Réserver"]];
  const TABS_M=[["info","📋"],["menu","🍽"],["offres","🔥"],["events","📅"],["photos","📸"],["avis","⭐"],["map","🗺"],["reserve",isBar?"📞":"📅"]];
  const TABS = isMobile ? TABS_M : TABS_D;
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth:620, padding:0, overflow:"hidden", maxHeight:"95vh", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
        <div style={{ position:"relative", height:isMobile?130:170, overflow:"hidden", background:"#12080A" }}>
          <img src={PHOTOS[lieu.id]?.[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.72 }} onError={e => e.target.style.display="none"} />
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(18,8,10,0.9) 0%,rgba(18,8,10,0.2) 65%,transparent 100%)" }} />
          <button style={{ position:"absolute", top:14, right:14, background:"rgba(0,0,0,0.4)", border:"none", color:"#FFF", width:30, height:30, borderRadius:"50%", cursor:"pointer", fontSize:14 }} onClick={onClose}>✕</button>
          <div style={{ position:"absolute", bottom:14, left:20, right:60 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <h2 style={{ margin:0, color:"#FFF", fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:700 }}>{lieu.name}</h2>
              {lieu.premium && <span style={{ background:"#C8914A", color:"#FFF", fontSize:10, padding:"2px 8px", borderRadius:10, fontWeight:800 }}>PREMIUM</span>}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <Stars note={lieu.note} />
              <span style={{ color:"rgba(255,255,255,0.4)" }}>·</span>
              <span style={{ color:"#E8C882", fontSize:12 }}>⏱ {lieu.tempsRoute} min</span>
              <span style={{ color:"rgba(255,255,255,0.4)" }}>·</span>
              <OpenBadge schedule={lieu.schedule} small overlay />
            </div>
          </div>
        </div>
        <div style={{ padding:"10px 20px", background:"#FAFAF8", display:"flex", gap:6, flexWrap:"wrap", borderBottom:"1px solid #F0EDE8" }}>
          {lieu.tags.map(t => <span key={t} style={{ background:"#F0EDE8", color:"#7B5800", fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:600 }}>{t}</span>)}
          {(lieu.offers||[]).length>0 && <span style={{ background:"#FEF3C7", color:"#92400E", fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>🔥 {lieu.offers.length} offre{lieu.offers.length>1?"s":""}</span>}
          {(lieu.events||[]).length>0 && <span style={{ background:"#EDE9FE", color:"#5B21B6", fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>📅 {lieu.events.length} événement{lieu.events.length>1?"s":""}</span>}
        </div>
        <div style={{ display:"flex", background:"#FAFAF8", borderBottom:"1px solid #F0EDE8", overflowX:"auto" }}>
          {TABS.map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flexShrink:0, padding:isMobile?"10px 10px":"10px 12px", border:"none", background:tab===k?"#FFF":"none", color:tab===k?"#C8914A":"#999", fontWeight:tab===k?700:400, fontSize:isMobile?16:12, cursor:"pointer", fontFamily:"'Lato',sans-serif", borderBottom:tab===k?"2px solid #C8914A":"2px solid transparent", whiteSpace:"nowrap" }}>{l}</button>
          ))}
        </div>
        <div style={{ padding:isMobile?"14px 14px":"22px", maxHeight:isMobile?"60vh":"75vh", overflowY:"auto" }}>
          {tab==="info" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <p style={{ margin:0, color:"#555", lineHeight:1.7, fontSize:14 }}>{lieu.description}</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[["📍","Adresse",lieu.adresse],["📞","Téléphone",lieu.tel],["🏙","Arrondissement",lieu.arrondissement],["🪑","Capacité",`${lieu.places} places`]].map(([icon,lbl,val]) => (
                  <div key={lbl} style={{ background:"#F9F7F4", borderRadius:10, padding:"10px 13px" }}>
                    <div style={{ fontSize:11, color:"#AAA", marginBottom:2 }}>{icon} {lbl}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#2D1A00" }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:"#F9F7F4", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontWeight:700, fontSize:13, color:"#1A0A00" }}>🕐 Horaires</span>
                  <OpenBadge schedule={lieu.schedule} small />
                </div>
                {formatSchedule(lieu.schedule).map((s,i) => <div key={i} style={{ fontSize:12, color:"#666", marginBottom:3, display:"flex", gap:6 }}><span style={{ color:"#C8914A" }}>·</span>{s}</div>)}
              </div>
              <div>
                <div style={{ fontSize:11, color:"#AAA", fontWeight:700, marginBottom:8, textTransform:"uppercase" }}>Réseaux sociaux</div>
                <SocialLinks social={lieu.social} />
              </div>
            </div>
          )}
          {tab==="menu" && (
            <div>
              <p style={{ fontSize:13, color:"#888", margin:"0 0 16px" }}>Carte indicative · Les prix peuvent varier selon la saison.</p>
              {(lieu.menu||[]).map(cat => (
                <div key={cat.cat} style={{ marginBottom:20 }}>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:700, color:"#1A0A00", marginBottom:10, borderBottom:"1px solid #F0EDE8", paddingBottom:6 }}>{cat.cat}</div>
                  {cat.items.map(item => (
                    <div key={item.nom} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"8px 0", borderBottom:"1px solid #F9F7F4" }}>
                      <span style={{ fontSize:14, color:"#444" }}>{item.nom}</span>
                      <span style={{ fontSize:14, fontWeight:700, color:"#C8914A", marginLeft:12, flexShrink:0 }}>{item.prix}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {tab==="offres" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <p style={{ fontSize:13, color:"#888", margin:0 }}>Offres exclusives disponibles uniquement via L'Adresse.</p>
              {(lieu.offers||[]).length===0 && <p style={{ color:"#BBB", textAlign:"center", padding:"30px 0" }}>Aucune offre en ce moment</p>}
              {(lieu.offers||[]).map((o,i) => (
                <div key={i} style={{ background:"linear-gradient(135deg,#FEF3C7,#FFF8E8)", borderRadius:16, padding:"18px 20px", border:"1px solid #F0D58C" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:22 }}>{o.emoji}</span>
                        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:700, color:"#1A0A00" }}>{o.titre}</span>
                      </div>
                      <p style={{ margin:"0 0 6px", color:"#555", fontSize:13 }}>{o.desc}</p>
                      <span style={{ fontSize:11, color:"#92400E", fontWeight:600 }}>🗓 {o.validite}</span>
                    </div>
                    <div style={{ background:"#C8914A", color:"#FFF", fontWeight:800, fontSize:15, padding:"6px 14px", borderRadius:12, marginLeft:12, whiteSpace:"nowrap" }}>{o.prix}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab==="events" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {(lieu.events||[]).length===0 && <p style={{ color:"#BBB", textAlign:"center", padding:"30px 0" }}>Aucun événement à venir</p>}
              {(lieu.events||[]).map((ev,i) => (
                <div key={i} style={{ background:"#FFF", borderRadius:16, padding:"18px 20px", border:"1px solid #EDE9FE", boxShadow:"0 2px 12px rgba(91,33,182,0.06)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:22 }}>{ev.emoji}</span>
                    <div>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:"#1A0A00" }}>{ev.titre}</div>
                      <div style={{ fontSize:12, color:"#7C3AED", fontWeight:700 }}>{ev.date}</div>
                    </div>
                  </div>
                  <p style={{ margin:"0 0 10px", color:"#555", fontSize:13, lineHeight:1.6 }}>{ev.desc}</p>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"#7C3AED", fontWeight:600 }}>🪑 {ev.places} places</span>
                    <button onClick={() => onToast(`Inscription à "${ev.titre}" envoyée ✓`)} style={{ ...S.btnPrimary, padding:"7px 16px", fontSize:12 }}>S'inscrire →</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab==="photos" && <Gallery id={lieu.id} />}
          {tab==="avis" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, color:"#1A0A00" }}>{lieu.note.toFixed(1)} <span style={{ fontSize:18, color:"#C8914A" }}>★</span></div>
                  <div style={{ fontSize:12, color:"#AAA" }}>{avis.length} avis vérifiés</div>
                </div>
                <div style={{ background:"#E8F5E9", color:"#2E7D32", fontSize:12, fontWeight:700, padding:"6px 12px", borderRadius:20 }}>✓ Avis 100% vérifiés</div>
              </div>
              {avis.map((a,i) => (
                <div key={i} style={{ background:"#F9F7F4", borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#C8914A,#E8C882)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#1A0A00" }}>{a.auteur[0]}</div>
                      <div><div style={{ fontSize:13, fontWeight:700, color:"#1A0A00" }}>{a.auteur}</div><div style={{ fontSize:11, color:"#AAA" }}>{a.date}</div></div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <Stars note={a.note} size={11} />
                      {a.verifie && <span style={{ fontSize:10, color:"#2E7D32", fontWeight:700, background:"#E8F5E9", padding:"1px 6px", borderRadius:10 }}>✓ Vérifié</span>}
                    </div>
                  </div>
                  <p style={{ margin:0, fontSize:13, color:"#555", lineHeight:1.6 }}>{a.texte}</p>
                </div>
              ))}
              {!reviewSent ? (
                <div style={{ background:"#FFF", borderRadius:12, padding:16, border:"1px solid #EDE8E0" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#1A0A00", marginBottom:10 }}>Laisser un avis</div>
                  {!user && <div style={{ background:"#FBF0E8", borderRadius:10, padding:"10px 13px", fontSize:13, color:"#7B5800", marginBottom:10 }}>🔐 Connectez-vous pour laisser un avis vérifié.</div>}
                  <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                    {[1,2,3,4,5].map(n => <button key={n} onClick={() => setReviewForm(f => ({...f,note:n}))} style={{ fontSize:22, background:"none", border:"none", cursor:"pointer", color:n<=reviewForm.note?"#C8914A":"#DDD" }}>★</button>)}
                  </div>
                  <textarea style={{ ...S.input, height:70, resize:"none", marginBottom:10 }} placeholder="Partagez votre expérience…" value={reviewForm.texte} onChange={e => setReviewForm(f => ({...f,texte:e.target.value}))} />
                  <button onClick={submitReview} style={S.btnPrimary}>Publier mon avis →</button>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:16, background:"#E8F5E9", borderRadius:12 }}>
                  <div style={{ fontSize:30, marginBottom:4 }}>🙏</div>
                  <div style={{ fontWeight:700, color:"#2E7D32" }}>Merci pour votre avis !</div>
                </div>
              )}
            </div>
          )}
          {tab==="map" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ width:"100%", height:220, borderRadius:14, background:"linear-gradient(135deg,#E8E0D0,#D8CDB8)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8, border:"2px solid #F0EDE8" }}>
                <div style={{ fontSize:38 }}>🗺</div>
                <span style={{ color:"#888", fontSize:13 }}>Intégration Google Maps</span>
                <span style={{ color:"#BBB", fontSize:11 }}>{lieu.coords.lat}, {lieu.coords.lng}</span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {["🚶 À pied","🚗 Voiture","🚇 Métro"].map(m => (
                  <button key={m} onClick={() => onToast(`Itinéraire ${m} lancé`)} style={{ ...S.btnOutline, flex:1, padding:"8px 4px", fontSize:12 }}>{m}</button>
                ))}
              </div>
              <div style={{ background:"#F9F7F4", borderRadius:10, padding:"11px 13px", fontSize:13, color:"#666" }}>📍 {lieu.adresse}<br />⏱ Environ <strong>{lieu.tempsRoute} min</strong> depuis votre position</div>
            </div>
          )}
          {tab==="reserve" && (isBar ? (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <h3 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", fontSize:20 }}>Contacter {lieu.name}</h3>
              <div style={{ background:"#F9F7F4", borderRadius:12, padding:"16px 18px", display:"flex", flexDirection:"column", gap:10 }}>
                {[["📞","Téléphone",lieu.tel],["📍","Adresse",lieu.adresse]].map(([icon,lbl,val]) => (
                  <div key={lbl} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:18 }}>{icon}</span>
                    <div><div style={{ fontSize:11, color:"#AAA" }}>{lbl}</div><div style={{ fontWeight:700, color:"#1A0A00", fontSize:14 }}>{val}</div></div>
                  </div>
                ))}
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <span style={{ fontSize:18 }}>🕐</span>
                  <div>
                    <div style={{ fontSize:11, color:"#AAA", marginBottom:4 }}>Horaires</div>
                    {formatSchedule(lieu.schedule).map((s,i) => <div key={i} style={{ fontSize:13, color:"#444", marginBottom:2 }}>{s}</div>)}
                    <div style={{ marginTop:6 }}><OpenBadge schedule={lieu.schedule} small /></div>
                  </div>
                </div>
              </div>
              <div><div style={{ fontSize:11, color:"#AAA", fontWeight:700, marginBottom:8, textTransform:"uppercase" }}>Suivez-les</div><SocialLinks social={lieu.social} /></div>
              <a href={`tel:${lieu.tel.replace(/\s/g,"")}`} style={{ ...S.btnPrimary, textDecoration:"none", textAlign:"center", display:"block" }}>📞 Appeler le bar</a>
            </div>
          ) : (
            <ReservationForm lieu={lieu} onConfirm={onReserve} />
          ))}
        </div>
      </div>
    </div>
  );
};

const ReservationForm = ({ lieu, onConfirm }) => {
  const [form, setForm] = useState({ date:"", heure:"", couverts:2, message:"" });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
      <h3 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", fontSize:20 }}>Réserver chez {lieu.name}</h3>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
        <div><label style={S.label}>📅 Date</label><input style={S.input} type="date" value={form.date} onChange={e => setForm(f => ({...f,date:e.target.value}))} /></div>
        <div><label style={S.label}>🕐 Heure</label>
          <select style={S.input} value={form.heure} onChange={e => setForm(f => ({...f,heure:e.target.value}))}>
            <option value="">Choisir</option>
            {["12:00","12:30","13:00","13:30","19:00","19:30","20:00","20:30","21:00","21:30"].map(h => <option key={h}>{h}</option>)}
          </select>
        </div>
      </div>
      <div><label style={S.label}>👤 Couverts</label>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          {[1,2,3,4,5,6,8,10].map(n => <button key={n} onClick={() => setForm(f => ({...f,couverts:n}))} style={{ width:38, height:38, borderRadius:10, border:"1.5px solid", borderColor:form.couverts===n?"#C8914A":"#E0D8CF", background:form.couverts===n?"#FBF0E8":"#FFF", color:form.couverts===n?"#C8914A":"#888", fontWeight:form.couverts===n?700:400, cursor:"pointer", fontSize:13 }}>{n}</button>)}
        </div>
      </div>
      <div><label style={S.label}>💬 Message</label>
        <textarea style={{ ...S.input, height:68, resize:"none" }} placeholder="Allergie, occasion spéciale…" value={form.message} onChange={e => setForm(f => ({...f,message:e.target.value}))} />
      </div>
      <button style={S.btnPrimary} onClick={() => { if (!form.date||!form.heure) return alert("Choisissez une date et une heure"); onConfirm(form); }}>Confirmer la réservation →</button>
      <p style={{ fontSize:11, color:"#CCC", textAlign:"center", margin:0 }}>Confirmation par email · Annulation gratuite sous 24h</p>
    </div>
  );
};

const DashboardPhotos = ({ lieu, user }) => {
  const isMobile = useIsMobile();
  const fileRef = useRef();
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    const loadPhotos = async () => {
      const { data } = await supabase
        .from("etablissements")
        .select("photos")
        .eq("user_id", user?.id)
        .single();
      if (data?.photos && data.photos.length > 0) {
        setPhotos(data.photos.map((url, i) => ({ url, cover: i === 0 })));
      }
    };
    loadPhotos();
  }, []);

const addPhotos = async (e) => {
    const files = Array.from(e.target.files);
    const oversized = files.filter(f => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) { alert("Certaines photos dépassent 5 Mo. Veuillez choisir des fichiers plus légers."); e.target.value = ""; return; }
    const newPhotos = [];
    for (const file of files) {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { data, error } = await supabase.storage.from("photos").upload(fileName, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("photos").getPublicUrl(fileName);
        newPhotos.push({ url: urlData.publicUrl, cover: false });
      } else {
        newPhotos.push({ url: URL.createObjectURL(file), cover: false });
      }
    }
    const allPhotos = [...photos, ...newPhotos].slice(0, 8);
    setPhotos(allPhotos);
    await supabase.from("etablissements").update({ photos: allPhotos.map(p => p.url) }).eq("user_id", user?.id);
    e.target.value = "";
  };

  const remove = (i) => setPhotos(p => { const arr=p.filter((_,idx)=>idx!==i); if(arr.length>0&&!arr.some(ph=>ph.cover)) arr[0]={...arr[0],cover:true}; return arr; });
  const setCover = (i) => setPhotos(p => p.map((ph,idx) => ({...ph,cover:idx===i})));
  return (
    <div style={{ background:"#FFF", borderRadius:20, padding:28, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <h3 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#1A0A00" }}>📸 Mes photos</h3>
        <button onClick={() => fileRef.current.click()} style={S.btnPrimary}>+ Ajouter</button>
      </div>
      <p style={{ color:"#AAA", fontSize:13, margin:"0 0 20px" }}>{photos.length}/8 photos · La photo <strong style={{color:"#C8914A"}}>Cover</strong> s'affiche en premier</p>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={addPhotos} />
      {photos.length===0 ? (
        <div onClick={() => fileRef.current.click()} style={{ border:"2px dashed #C8B89A", borderRadius:16, padding:"40px 20px", textAlign:"center", cursor:"pointer", background:"#FBF8F4" }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📷</div>
          <div style={{ fontWeight:700, color:"#C8914A", marginBottom:4 }}>Ajouter vos premières photos</div>
          <div style={{ fontSize:13, color:"#AAA" }}>JPG, PNG · 5 Mo max · Jusqu'à 8 photos</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(4,1fr)", gap:8 }}>
          {photos.map((ph,i) => (
            <div key={i} style={{ position:"relative", aspectRatio:"1", borderRadius:12, overflow:"hidden", border:ph.cover?"2px solid #C8914A":"2px solid #EDE8E0" }}>
              <img src={ph.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => e.target.style.opacity=0.3} />
              {ph.cover && <span style={{ position:"absolute", top:5, left:5, background:"#C8914A", color:"#FFF", fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:8 }}>COVER</span>}
              <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent,rgba(0,0,0,0.7))", padding:"16px 5px 5px", display:"flex", gap:3, justifyContent:"center" }}>
                {!ph.cover && <button onClick={() => setCover(i)} style={{ background:"rgba(200,145,74,0.9)", border:"none", color:"#FFF", borderRadius:6, padding:"3px 6px", fontSize:9, cursor:"pointer", fontFamily:"'Lato',sans-serif", fontWeight:700 }}>⭐ Cover</button>}
                <button onClick={() => remove(i)} style={{ background:"rgba(185,28,28,0.85)", border:"none", color:"#FFF", borderRadius:6, padding:"3px 6px", fontSize:9, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>✕</button>
              </div>
            </div>
          ))}
          {photos.length<8 && (
            <div onClick={() => fileRef.current.click()} style={{ aspectRatio:"1", borderRadius:12, border:"2px dashed #C8B89A", background:"#FBF8F4", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:5, cursor:"pointer" }}>
              <span style={{ fontSize:24 }}>+</span>
              <span style={{ fontSize:11, color:"#AAA" }}>Ajouter</span>
            </div>
          )}
        </div>
      )}
      <div style={{ background:"#FBF0E8", borderRadius:12, padding:"11px 16px", marginTop:16, border:"1px solid #F0D5B0" }}>
        <div style={{ fontSize:12, color:"#7B5800" }}>💡 Les établissements avec 4+ photos reçoivent <strong>2x plus de clics</strong>.</div>
      </div>
    </div>
  );
};

// ─── COMPOSANTS ÉDITION INLINE ────────────────────────────────────────────────
const EditItemRow = ({ item, onSave, onCancel }) => {
  const [nom, setNom] = useState(item.nom);
  const [prix, setPrix] = useState(item.prix);
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", padding:"8px 0", borderBottom:"1px solid #F9F7F4", flexWrap:"wrap" }}>
      <input style={{ ...S.input, flex:2, minWidth:140 }} value={nom} onChange={e => setNom(e.target.value)} autoFocus />
      <input style={{ ...S.input, flex:1, minWidth:70 }} value={prix} onChange={e => setPrix(e.target.value)} placeholder="Prix" />
      <button onClick={() => onSave(nom, prix)} style={{ ...S.btnPrimary, padding:"7px 14px", fontSize:12 }}>✓</button>
      <button onClick={onCancel} style={{ ...S.btnOutline, padding:"7px 14px", fontSize:12 }}>✕</button>
    </div>
  );
};

const EditOffreRow = ({ offre, onSave, onCancel }) => {
  const [d, setD] = useState({ titre:offre.titre, desc:offre.desc, prix:offre.prix, validite:offre.validite, emoji:offre.emoji });
  const up = f => setD(p => ({...p,...f}));
  return (
    <div style={{ background:"#FBF0E8", borderRadius:14, padding:"16px 18px", marginBottom:12, border:"1px solid #F0D5B0" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        <div><label style={S.label}>Emoji</label><input style={S.input} value={d.emoji} onChange={e => up({emoji:e.target.value})} /></div>
        <div><label style={S.label}>Prix</label><input style={S.input} value={d.prix} onChange={e => up({prix:e.target.value})} /></div>
      </div>
      <div style={{ marginBottom:8 }}><label style={S.label}>Titre</label><input style={S.input} value={d.titre} onChange={e => up({titre:e.target.value})} /></div>
      <div style={{ marginBottom:8 }}><label style={S.label}>Description</label><input style={S.input} value={d.desc} onChange={e => up({desc:e.target.value})} /></div>
      <div style={{ marginBottom:12 }}><label style={S.label}>Validité</label><input style={S.input} value={d.validite} onChange={e => up({validite:e.target.value})} /></div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => onSave(d)} style={S.btnPrimary}>💾 Sauvegarder</button>
        <button onClick={onCancel} style={S.btnOutline}>Annuler</button>
      </div>
    </div>
  );
};

const EditEventRow = ({ event, onSave, onCancel }) => {
  const [d, setD] = useState({ titre:event.titre, date:event.date, desc:event.desc, places:event.places, emoji:event.emoji });
  const up = f => setD(p => ({...p,...f}));
  return (
    <div style={{ background:"#F5F3FF", borderRadius:14, padding:"16px 18px", marginBottom:12, border:"1px solid #DDD6FE" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        <div><label style={S.label}>Emoji</label><input style={S.input} value={d.emoji} onChange={e => up({emoji:e.target.value})} /></div>
        <div><label style={S.label}>Places</label><input style={S.input} type="number" min="1" value={d.places} onChange={e => up({places:parseInt(e.target.value)||0})} /></div>
      </div>
      <div style={{ marginBottom:8 }}><label style={S.label}>Titre</label><input style={S.input} value={d.titre} onChange={e => up({titre:e.target.value})} /></div>
      <div style={{ marginBottom:8 }}><label style={S.label}>Date</label><input style={S.input} value={d.date} onChange={e => up({date:e.target.value})} /></div>
      <div style={{ marginBottom:12 }}><label style={S.label}>Description</label><textarea style={{...S.input,height:68,resize:"none"}} value={d.desc} onChange={e => up({desc:e.target.value})} /></div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => onSave(d)} style={S.btnPrimary}>💾 Sauvegarder</button>
        <button onClick={onCancel} style={S.btnOutline}>Annuler</button>
      </div>
    </div>
  );
};

const DashboardPro = ({ user, onLogout }) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);

  // ── État fiche ──
  const [fiche, setFiche] = useState({ name:"", type:"", adresse:"", tel:"", description:"", priceRange:"€€", ambiance:"", arrondissement:"", places:"" });
  const [etablissementId, setEtablissementId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({});

  // ── Menu ──
  const [menu, setMenu] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [newPlat, setNewPlat] = useState({ catIndex:0, nom:"", prix:"" });
  const [showAddPlat, setShowAddPlat] = useState(false);

  // ── Offres ──
  const [offres, setOffres] = useState([]);
  const [editingOffre, setEditingOffre] = useState(null);
  const [showAddOffre, setShowAddOffre] = useState(false);
  const [newOffre, setNewOffre] = useState({ titre:"", desc:"", prix:"", validite:"", emoji:"🔥" });

  // ── Événements ──
  const [events, setEvents] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ titre:"", date:"", desc:"", places:"", emoji:"📅" });

  // ── Réservations ──
  const [reservations, setReservations] = useState([]);

  const [proTab, setProTab] = useState("fiche");
  const [toast, setToast] = useState("");
  const showToast = (msg) => setToast(msg);

  // ── Chargement initial depuis Supabase ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: etab } = await supabase
          .from("etablissements")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (etab) {
          setEtablissementId(etab.id);
          const f = {
            name: etab.name || "",
            type: etab.type || "",
            adresse: etab.adresse || "",
            tel: etab.tel || "",
            description: etab.description || "",
            priceRange: etab.price_range || "€€",
            ambiance: etab.ambiance || "",
            arrondissement: etab.arrondissement || "",
            places: etab.places || "",
          };
          setFiche(f);
          setEditDraft(f);
          if (etab.menu) setMenu(etab.menu);

          const { data: offresData } = await supabase
            .from("offres")
            .select("*")
            .eq("etablissement_id", etab.id);
          if (offresData) setOffres(offresData);

          const { data: eventsData } = await supabase
            .from("events")
            .select("*")
            .eq("etablissement_id", etab.id);
          if (eventsData) setEvents(eventsData);

          const { data: resaData } = await supabase
            .from("reservations")
            .select("*")
            .eq("etablissement_id", etab.id)
            .order("created_at", { ascending: false });
          if (resaData) setReservations(resaData);
        }
      } catch(e) { showToast("Erreur de chargement"); }
      setLoading(false);
    };
    load();
  }, [user.id]);

  // ── Fiche ──
  const saveFiche = async () => {
    const payload = {
      user_id: user.id,
      name: editDraft.name,
      type: editDraft.type,
      adresse: editDraft.adresse,
      tel: editDraft.tel,
      description: editDraft.description,
      price_range: editDraft.priceRange,
      ambiance: editDraft.ambiance,
      arrondissement: editDraft.arrondissement,
      places: editDraft.places,
    };
    if (etablissementId) {
      await supabase.from("etablissements").update(payload).eq("id", etablissementId);
    } else {
      const { data } = await supabase.from("etablissements").insert(payload).select().single();
      if (data) setEtablissementId(data.id);
    }
    setFiche({...editDraft});
    setEditMode(false);
    showToast("Fiche sauvegardée ✓");
  };
  const cancelEdit = () => { setEditDraft({...fiche}); setEditMode(false); };

  // ── Menu (stocké en JSON dans etablissements) ──
  const saveMenuToDB = async (newMenu) => {
    if (!etablissementId) return;
    await supabase.from("etablissements").update({ menu: newMenu }).eq("id", etablissementId);
  };
  const saveItem = async (catIndex, itemId, newNom, newPrix) => {
    const newMenu = menu.map((cat, ci) => ci!==catIndex ? cat : {
      ...cat, items: cat.items.map(it => it.id===itemId ? {...it, nom:newNom, prix:newPrix} : it)
    });
    setMenu(newMenu); await saveMenuToDB(newMenu);
    setEditingItem(null); showToast("Plat modifié ✓");
  };
  const deleteItem = async (catIndex, itemId) => {
    const newMenu = menu.map((cat, ci) => ci!==catIndex ? cat : {
      ...cat, items: cat.items.filter(it => it.id!==itemId)
    });
    setMenu(newMenu); await saveMenuToDB(newMenu);
    showToast("Plat supprimé");
  };
  const addPlat = async () => {
    if (!newPlat.nom.trim() || !newPlat.prix.trim()) return showToast("Nom et prix requis");
    const newMenu = menu.map((cat, ci) => ci!==newPlat.catIndex ? cat : {
      ...cat, items: [...(cat.items||[]), { id: Date.now(), nom: newPlat.nom, prix: newPlat.prix }]
    });
    setMenu(newMenu); await saveMenuToDB(newMenu);
    setNewPlat(p => ({...p, nom:"", prix:""}));
    setShowAddPlat(false); showToast("Plat ajouté ✓");
  };

  // ── Offres ──
  const saveOffre = async (id, data) => {
    await supabase.from("offres").update(data).eq("id", id);
    setOffres(o => o.map(of => of.id===id ? {...of,...data} : of));
    setEditingOffre(null); showToast("Offre modifiée ✓");
  };
  const deleteOffre = async (id) => {
    await supabase.from("offres").delete().eq("id", id);
    setOffres(o => o.filter(of => of.id!==id));
    showToast("Offre supprimée");
  };
  const addOffre = async () => {
    if (!newOffre.titre.trim()) return showToast("Titre requis");
    const { data } = await supabase
      .from("offres")
      .insert({ ...newOffre, etablissement_id: etablissementId })
      .select().single();
    if (data) setOffres(o => [...o, data]);
    setNewOffre({ titre:"", desc:"", prix:"", validite:"", emoji:"🔥" });
    setShowAddOffre(false); showToast("Offre ajoutée ✓");
  };

  // ── Événements ──
  const saveEvent = async (id, data) => {
    await supabase.from("events").update(data).eq("id", id);
    setEvents(e => e.map(ev => ev.id===id ? {...ev,...data} : ev));
    setEditingEvent(null); showToast("Événement modifié ✓");
  };
  const deleteEvent = async (id) => {
    await supabase.from("events").delete().eq("id", id);
    setEvents(e => e.filter(ev => ev.id!==id));
    showToast("Événement supprimé");
  };
  const addEvent = async () => {
    if (!newEvent.titre.trim() || !newEvent.date.trim()) return showToast("Titre et date requis");
    const { data } = await supabase
      .from("events")
      .insert({ ...newEvent, places: parseInt(newEvent.places)||20, etablissement_id: etablissementId })
      .select().single();
    if (data) setEvents(e => [...e, data]);
    setNewEvent({ titre:"", date:"", desc:"", places:"", emoji:"📅" });
    setShowAddEvent(false); showToast("Événement ajouté ✓");
  };

  // ── Réservations ──
  const confirmerResa = async (id) => {
    await supabase.from("reservations").update({ statut:"Confirmée" }).eq("id", id);
    setReservations(r => r.map(r2 => r2.id===id ? {...r2, statut:"Confirmée"} : r2));
    showToast("Réservation confirmée ✓");
  };
  const refuserResa = async (id) => {
    await supabase.from("reservations").update({ statut:"Refusée" }).eq("id", id);
    setReservations(r => r.map(r2 => r2.id===id ? {...r2, statut:"Refusée"} : r2));
    showToast("Réservation refusée");
  };
  const annulerResa = async (id) => {
    await supabase.from("reservations").delete().eq("id", id);
    setReservations(r => r.filter(r2 => r2.id!==id));
    showToast("Réservation supprimée");
  };

  const inp = S.input;
  const AMBIANCES = ["Romantique","Zen","Convivial","Authentique","Festif","Familial","Branché","Décontracté","Rooftop","Vintage","Chic"];
  const BUDGETS = ["€","€€","€€€","€€€€"];

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#F5F2EE", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, fontFamily:"'Lato',sans-serif" }}>
      <div style={{ fontSize:40 }}>⏳</div>
      <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#1A0A00" }}>Chargement de votre espace…</p>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#F5F2EE", fontFamily:"'Lato',sans-serif" }}>
      {toast && <Toast msg={toast} onHide={() => setToast("")} />}

      <div style={{ background:"#12080A", padding:isMobile?"0 14px":"0 28px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Logo light />
        <div style={{ display:"flex", alignItems:"center", gap:isMobile?8:14 }}>
          {!isMobile && <span style={{ color:"#E8C882", fontSize:13 }}>✦ Espace Pro</span>}
          <span style={{ color:"rgba(255,255,255,0.6)", fontSize:12 }}>{user.nom?.split(" ")[0]}</span>
          <button onClick={onLogout} style={{ background:"rgba(255,255,255,0.1)", color:"#FFF", border:"1px solid rgba(255,255,255,0.2)", padding:"5px 12px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>⎋ Quitter</button>
        </div>
      </div>

      <div style={{ maxWidth:960, margin:"0 auto", padding:isMobile?"16px 12px 80px":"36px 20px" }}>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30, color:"#1A0A00", margin:"0 0 6px" }}>Bonjour, {user.nom} 👋</h2>
        <p style={{ color:"#999", fontSize:14, margin:"0 0 24px" }}>Gérez votre établissement et suivez vos performances.</p>

        {/* Stats temps réel */}
        {(() => {
          const totalPlats = menu.reduce((acc, cat) => acc + (cat.items?.length||0), 0);
          const totalPlaces = events.reduce((acc, ev) => acc + (ev.places||0), 0);
          const resaConfirmees = reservations.filter(r => r.statut==="Confirmée").length;
          const resaEnAttente  = reservations.filter(r => r.statut==="En attente").length;
          const stats = [
            { icon:"📅", label:"Réservations", value:reservations.length, sub:`${resaConfirmees} confirmée(s) · ${resaEnAttente} en attente`, badge:resaEnAttente>0?`${resaEnAttente} à traiter`:"À jour", badgeColor:resaEnAttente>0?"#F9A825":"#43A047", badgeBg:resaEnAttente>0?"#FFF8E1":"#E8F5E9" },
            { icon:"🍽", label:"Plats au menu", value:totalPlats, sub:`${menu.length} catégorie(s)`, badge:totalPlats>0?"En ligne":"Vide", badgeColor:totalPlats>0?"#43A047":"#E53935", badgeBg:totalPlats>0?"#E8F5E9":"#FFEBEE" },
            { icon:"🔥", label:"Offres actives", value:offres.length, sub:offres.length>0?"Visibles sur la fiche":"Aucune offre", badge:offres.length>0?"Actives":"Inactif", badgeColor:offres.length>0?"#C8914A":"#AAA", badgeBg:offres.length>0?"#FBF0E8":"#F5F5F5" },
            { icon:"🎉", label:"Événements", value:events.length, sub:events.length>0?`${totalPlaces} places proposées`:"Aucun événement", badge:events.length>0?"À venir":"Aucun", badgeColor:events.length>0?"#7C3AED":"#AAA", badgeBg:events.length>0?"#EDE9FE":"#F5F5F5" },
          ];
          return (
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:isMobile?10:14, marginBottom:20 }}>
              {stats.map(st => (
                <div key={st.label} style={{ background:"#FFF", borderRadius:16, padding:"16px 18px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                    <span style={{ fontSize:20 }}>{st.icon}</span>
                    <span style={{ fontSize:10, color:st.badgeColor, fontWeight:700, background:st.badgeBg, padding:"2px 9px", borderRadius:10, whiteSpace:"nowrap" }}>{st.badge}</span>
                  </div>
                  <div style={{ fontSize:28, fontWeight:900, color:"#1A0A00", margin:"2px 0" }}>{st.value}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#444", marginBottom:2 }}>{st.label}</div>
                  <div style={{ fontSize:11, color:"#AAA" }}>{st.sub}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:16, background:"#FFF", padding:5, borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflowX:"auto" }}>
          {[["fiche","🏪","Fiche"],["photos","📸","Photos"],["menu","🍽","Menu"],["offres","🔥","Offres"],["events","📅","Events"],["reservations","📋","Résa"]].map(([k,ic,l]) => (
            <button key={k} onClick={() => setProTab(k)} style={{ flexShrink:0, padding:isMobile?"8px 10px":"8px 14px", border:"none", borderRadius:10, background:proTab===k?"#C8914A":"transparent", color:proTab===k?"#FFF":"#888", fontWeight:700, fontSize:isMobile?11:12, cursor:"pointer", fontFamily:"'Lato',sans-serif", whiteSpace:"nowrap" }}>{isMobile?ic:`${ic} ${l}`}</button>
          ))}
        </div>

        {/* ── FICHE ── */}
        {proTab==="fiche" && (
          <div style={{ background:"#FFF", borderRadius:16, padding:isMobile?"16px":"24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <h3 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#1A0A00" }}>Ma fiche établissement</h3>
              <div style={{ display:"flex", gap:8 }}>
                {editMode && <button onClick={cancelEdit} style={{ ...S.btnOutline, padding:"8px 16px", fontSize:13 }}>Annuler</button>}
                <button onClick={() => editMode ? saveFiche() : (setEditDraft({...fiche}), setEditMode(true))} style={editMode?S.btnPrimary:S.btnOutline}>
                  {editMode?"💾 Sauvegarder":"✏️ Modifier"}
                </button>
              </div>
            </div>
            {editMode ? (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                  {[["Nom de l'établissement","name"],["Type de cuisine / bar","type"],["Adresse complète","adresse"],["Téléphone","tel"],["Arrondissement","arrondissement"],["Nombre de places","places"]].map(([label,key]) => (
                    <div key={key}>
                      <label style={S.label}>{label}</label>
                      <input style={inp} value={editDraft[key]||""} onChange={e => setEditDraft(d => ({...d,[key]:e.target.value}))} />
                    </div>
                  ))}
                </div>
                <div>
                  <label style={S.label}>Budget moyen</label>
                  <div style={{ display:"flex", gap:8, marginTop:4 }}>
                    {BUDGETS.map(p => (
                      <button key={p} onClick={() => setEditDraft(d => ({...d,priceRange:p}))} style={{ flex:1, padding:"9px 4px", borderRadius:12, border:"2px solid", borderColor:editDraft.priceRange===p?"#C8914A":"#E8E0D0", background:editDraft.priceRange===p?"#FBF0E8":"#FFF", color:editDraft.priceRange===p?"#C8914A":"#888", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{p}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={S.label}>Ambiance</label>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
                    {AMBIANCES.map(a => (
                      <button key={a} onClick={() => setEditDraft(d => ({...d,ambiance:a}))} style={{ padding:"6px 13px", borderRadius:20, border:"1.5px solid", borderColor:editDraft.ambiance===a?"#C8914A":"#E8E0D0", background:editDraft.ambiance===a?"#FBF0E8":"#FFF", color:editDraft.ambiance===a?"#C8914A":"#888", fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{a}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={S.label}>Description</label>
                  <textarea style={{...inp, height:90, resize:"none", marginTop:4}} value={editDraft.description||""} onChange={e => setEditDraft(d => ({...d,description:e.target.value}))} />
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:12 }}>
                  {[["🏪","Nom",fiche.name||"—"],["🍽","Type",fiche.type||"—"],["📍","Adresse",fiche.adresse||"—"],["📞","Téléphone",fiche.tel||"—"],["🏙","Arrondissement",fiche.arrondissement||"—"],["🪑","Places",fiche.places?`${fiche.places} couverts`:"—"],["💰","Budget",fiche.priceRange||"—"],["✨","Ambiance",fiche.ambiance||"—"]].map(([icon,label,val]) => (
                    <div key={label} style={{ background:"#F9F7F4", borderRadius:10, padding:"10px 14px" }}>
                      <div style={{ fontSize:11, color:"#AAA", marginBottom:2 }}>{icon} {label}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#2D1A00" }}>{val}</div>
                    </div>
                  ))}
                </div>
                {fiche.description && (
                  <div style={{ background:"#F9F7F4", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
                    <div style={{ fontSize:11, color:"#AAA", marginBottom:4 }}>📝 DESCRIPTION</div>
                    <p style={{ margin:0, fontSize:13, color:"#555", lineHeight:1.6 }}>{fiche.description}</p>
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop:16, background:"linear-gradient(135deg,#FBF0E8,#FFF5EC)", borderRadius:12, padding:"13px 17px", border:"1px solid #F0D5B0" }}>
              <div style={{ fontWeight:800, color:"#C8914A", fontSize:14 }}>✦ Abonnement Premium actif — 29€/mois</div>
              <div style={{ fontSize:12, color:"#8B5E00", marginTop:4 }}>Menu · Offres · Événements · Avis vérifiés · Collections · Badge Premium</div>
            </div>
          </div>
        )}

        {/* ── PHOTOS ── */}
        {proTab==="photos" && <DashboardPhotos lieu={LIEUX[0]} />}

        {/* ── MENU ── */}
        {proTab==="menu" && (
          <div style={{ background:"#FFF", borderRadius:20, padding:isMobile?18:28, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h3 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#1A0A00" }}>Mon menu en ligne</h3>
              <button onClick={() => setShowAddPlat(p => !p)} style={S.btnPrimary}>+ Ajouter un plat</button>
            </div>
            {showAddPlat && (
              <div style={{ background:"#FBF0E8", borderRadius:14, padding:"16px 18px", marginBottom:20, border:"1px solid #F0D5B0" }}>
                <div style={{ fontWeight:700, color:"#C8914A", fontSize:14, marginBottom:12 }}>Nouveau plat</div>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={S.label}>Catégorie</label>
                    <select style={inp} value={newPlat.catIndex} onChange={e => setNewPlat(p => ({...p, catIndex:parseInt(e.target.value)}))}>
                      {menu.map((cat,i) => <option key={i} value={i}>{cat.cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Prix</label>
                    <input style={inp} placeholder="ex : 18€" value={newPlat.prix} onChange={e => setNewPlat(p => ({...p,prix:e.target.value}))} />
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={S.label}>Nom du plat</label>
                  <input style={inp} placeholder="ex : Tartare de bœuf maison" value={newPlat.nom} onChange={e => setNewPlat(p => ({...p,nom:e.target.value}))} onKeyDown={e => e.key==="Enter" && addPlat()} />
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={addPlat} style={S.btnPrimary}>Ajouter →</button>
                  <button onClick={() => setShowAddPlat(false)} style={S.btnOutline}>Annuler</button>
                </div>
              </div>
            )}
            {menu.length === 0 && <p style={{ color:"#CCC", textAlign:"center", padding:"30px 0" }}>Aucun plat dans le menu</p>}
            {menu.map((cat, catIndex) => (
              <div key={catIndex} style={{ marginBottom:22 }}>
                <div style={{ fontWeight:700, color:"#1A0A00", fontSize:15, marginBottom:8, paddingBottom:6, borderBottom:"1px solid #F0EDE8" }}>{cat.cat}</div>
                {(cat.items||[]).map(item => (
                  <div key={item.id}>
                    {editingItem?.itemId===item.id ? (
                      <EditItemRow item={item} onSave={(nom,prix) => saveItem(catIndex, item.id, nom, prix)} onCancel={() => setEditingItem(null)} />
                    ) : (
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #F9F7F4" }}>
                        <span style={{ fontSize:13, color:"#444" }}>{item.nom}</span>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontWeight:700, color:"#C8914A", fontSize:13 }}>{item.prix}</span>
                          <button onClick={() => setEditingItem({ catIndex, itemId:item.id })} style={{ background:"none", border:"none", cursor:"pointer", fontSize:15, padding:"2px 5px" }}>✏️</button>
                          <button onClick={() => deleteItem(catIndex, item.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:15, padding:"2px 5px" }}>🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── OFFRES ── */}
        {proTab==="offres" && (
          <div style={{ background:"#FFF", borderRadius:20, padding:isMobile?18:28, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h3 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#1A0A00" }}>Mes offres exclusives</h3>
              <button onClick={() => setShowAddOffre(p => !p)} style={S.btnPrimary}>+ Créer une offre</button>
            </div>
            {showAddOffre && (
              <div style={{ background:"#FBF0E8", borderRadius:14, padding:"16px 18px", marginBottom:20, border:"1px solid #F0D5B0" }}>
                <div style={{ fontWeight:700, color:"#C8914A", fontSize:14, marginBottom:12 }}>Nouvelle offre</div>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div><label style={S.label}>Emoji</label><input style={inp} placeholder="🔥" value={newOffre.emoji} onChange={e => setNewOffre(o => ({...o,emoji:e.target.value}))} /></div>
                  <div><label style={S.label}>Prix / Remise</label><input style={inp} placeholder="ex : 29€ ou -20%" value={newOffre.prix} onChange={e => setNewOffre(o => ({...o,prix:e.target.value}))} /></div>
                </div>
                <div style={{ marginBottom:10 }}><label style={S.label}>Titre *</label><input style={inp} placeholder="ex : Happy Hour" value={newOffre.titre} onChange={e => setNewOffre(o => ({...o,titre:e.target.value}))} /></div>
                <div style={{ marginBottom:10 }}><label style={S.label}>Description</label><input style={inp} placeholder="ex : 2 cocktails pour le prix d'1" value={newOffre.desc} onChange={e => setNewOffre(o => ({...o,desc:e.target.value}))} /></div>
                <div style={{ marginBottom:14 }}><label style={S.label}>Validité</label><input style={inp} placeholder="ex : Lun–Ven 18h–20h" value={newOffre.validite} onChange={e => setNewOffre(o => ({...o,validite:e.target.value}))} /></div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={addOffre} style={S.btnPrimary}>Ajouter →</button>
                  <button onClick={() => setShowAddOffre(false)} style={S.btnOutline}>Annuler</button>
                </div>
              </div>
            )}
            {offres.length===0 && <p style={{ color:"#CCC", textAlign:"center", padding:"30px 0" }}>Aucune offre. Créez-en une !</p>}
            {offres.map(o => (
              <div key={o.id}>
                {editingOffre?.id===o.id ? (
                  <EditOffreRow offre={o} onSave={data => saveOffre(o.id, data)} onCancel={() => setEditingOffre(null)} />
                ) : (
                  <div style={{ background:"#FEF3C7", borderRadius:14, padding:"16px 18px", marginBottom:12, border:"1px solid #F0D58C" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:22 }}>{o.emoji}</span>
                      <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:"#1A0A00" }}>{o.titre}</span>
                      <span style={{ background:"#C8914A", color:"#FFF", fontWeight:800, fontSize:12, padding:"3px 12px", borderRadius:10, marginLeft:"auto" }}>{o.prix}</span>
                    </div>
                    <p style={{ margin:"0 0 4px", color:"#555", fontSize:13 }}>{o.desc}</p>
                    <span style={{ fontSize:11, color:"#92400E", fontWeight:600 }}>🗓 {o.validite}</span>
                    <div style={{ display:"flex", gap:8, marginTop:10 }}>
                      <button onClick={() => setEditingOffre(o)} style={{ ...S.btnOutline, padding:"5px 14px", fontSize:12 }}>✏️ Modifier</button>
                      <button onClick={() => deleteOffre(o.id)} style={{ background:"none", border:"1.5px solid #EF9A9A", color:"#C62828", padding:"5px 14px", borderRadius:30, fontSize:12, cursor:"pointer", fontWeight:700, fontFamily:"'Lato',sans-serif" }}>🗑️ Supprimer</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── ÉVÉNEMENTS ── */}
        {proTab==="events" && (
          <div style={{ background:"#FFF", borderRadius:20, padding:isMobile?18:28, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h3 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#1A0A00" }}>Mes événements</h3>
              <button onClick={() => setShowAddEvent(p => !p)} style={S.btnPrimary}>+ Créer un événement</button>
            </div>
            {showAddEvent && (
              <div style={{ background:"#F5F3FF", borderRadius:14, padding:"16px 18px", marginBottom:20, border:"1px solid #DDD6FE" }}>
                <div style={{ fontWeight:700, color:"#7C3AED", fontSize:14, marginBottom:12 }}>Nouvel événement</div>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div><label style={S.label}>Emoji</label><input style={inp} placeholder="📅" value={newEvent.emoji} onChange={e => setNewEvent(v => ({...v,emoji:e.target.value}))} /></div>
                  <div><label style={S.label}>Nombre de places</label><input style={inp} type="number" min="1" placeholder="ex : 30" value={newEvent.places} onChange={e => setNewEvent(v => ({...v,places:e.target.value}))} /></div>
                </div>
                <div style={{ marginBottom:10 }}><label style={S.label}>Titre</label><input style={inp} placeholder="ex : Soirée dégustation" value={newEvent.titre} onChange={e => setNewEvent(v => ({...v,titre:e.target.value}))} /></div>
                <div style={{ marginBottom:10 }}><label style={S.label}>Date *</label><input style={inp} placeholder="ex : Sam 15 Mar" value={newEvent.date} onChange={e => setNewEvent(v => ({...v,date:e.target.value}))} /></div>
                <div style={{ marginBottom:14 }}><label style={S.label}>Description</label><textarea style={{...inp,height:70,resize:"none"}} placeholder="Décrivez l'événement…" value={newEvent.desc} onChange={e => setNewEvent(v => ({...v,desc:e.target.value}))} /></div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={addEvent} style={S.btnPrimary}>Ajouter →</button>
                  <button onClick={() => setShowAddEvent(false)} style={S.btnOutline}>Annuler</button>
                </div>
              </div>
            )}
            {events.length===0 && <p style={{ color:"#CCC", textAlign:"center", padding:"30px 0" }}>Aucun événement. Créez-en un !</p>}
            {events.map(ev => (
              <div key={ev.id}>
                {editingEvent?.id===ev.id ? (
                  <EditEventRow event={ev} onSave={data => saveEvent(ev.id, data)} onCancel={() => setEditingEvent(null)} />
                ) : (
                  <div style={{ background:"#F5F3FF", borderRadius:14, padding:"16px 18px", marginBottom:12, border:"1px solid #DDD6FE" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <span style={{ fontSize:22 }}>{ev.emoji}</span>
                      <div>
                        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, fontWeight:700, color:"#1A0A00" }}>{ev.titre}</div>
                        <div style={{ fontSize:12, color:"#7C3AED", fontWeight:700 }}>{ev.date} · {ev.places} places</div>
                      </div>
                    </div>
                    {ev.desc && <p style={{ margin:"0 0 10px", fontSize:13, color:"#555", lineHeight:1.5 }}>{ev.desc}</p>}
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => setEditingEvent(ev)} style={{ ...S.btnOutline, padding:"5px 14px", fontSize:12 }}>✏️ Modifier</button>
                      <button onClick={() => deleteEvent(ev.id)} style={{ background:"none", border:"1.5px solid #EF9A9A", color:"#C62828", padding:"5px 14px", borderRadius:30, fontSize:12, cursor:"pointer", fontWeight:700, fontFamily:"'Lato',sans-serif" }}>🗑️ Supprimer</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── RÉSERVATIONS ── */}
        {proTab==="reservations" && (
          <div style={{ background:"#FFF", borderRadius:20, padding:isMobile?18:28, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <h3 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#1A0A00" }}>Réservations</h3>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["Toutes","Confirmée","En attente","Refusée"].map(s => (
                  <span key={s} style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:12, background:"#F9F7F4", color:"#888" }}>
                    {reservations.filter(r => s==="Toutes"||r.statut===s).length} {s==="Toutes"?"total":s.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
            {reservations.length===0 && <p style={{ color:"#CCC", textAlign:"center", padding:"30px 0" }}>Aucune réservation pour le moment</p>}
            {reservations.map((r,i) => (
              <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 0", borderBottom:i<reservations.length-1?"1px solid #F5F2EE":"none" }}>
                <div>
                  <div style={{ fontWeight:700, color:"#2D1A00", fontSize:14 }}>{r.nom}</div>
                  <div style={{ fontSize:12, color:"#AAA", marginTop:2 }}>{r.date} · {r.couverts} couvert{r.couverts>1?"s":""}</div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end" }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:20,
                    background:r.statut==="Confirmée"?"#E8F5E9":r.statut==="Refusée"?"#FFEBEE":"#FFF8E1",
                    color:r.statut==="Confirmée"?"#388E3C":r.statut==="Refusée"?"#C62828":"#F9A825" }}>
                    {r.statut}
                  </span>
                  {r.statut==="En attente" && <>
                    <button onClick={() => confirmerResa(r.id)} style={{ ...S.btnPrimary, padding:"4px 12px", fontSize:11 }}>✓ Confirmer</button>
                    <button onClick={() => refuserResa(r.id)} style={{ background:"none", border:"1.5px solid #EF9A9A", color:"#C62828", padding:"4px 12px", borderRadius:30, fontSize:11, cursor:"pointer", fontWeight:700, fontFamily:"'Lato',sans-serif" }}>✕ Refuser</button>
                  </>}
                  {(r.statut==="Confirmée"||r.statut==="Refusée") && (
                    <button onClick={() => annulerResa(r.id)} style={{ background:"none", border:"1.5px solid #E0D8CF", color:"#AAA", padding:"4px 10px", borderRadius:30, fontSize:10, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Card = ({ lieu, onOpen }) => {
  const isBar = lieu.categorie==="bar";
  const hasEvents = (lieu.events||[]).length>0;
  const hasOffers = (lieu.offers||[]).length>0;
  return (
    <div onClick={onOpen} style={{ background:"#FFF", borderRadius:20, overflow:"hidden", boxShadow:"0 2px 16px rgba(0,0,0,0.07)", cursor:"pointer", transition:"all .25s", border:"1px solid #F0EDE8", position:"relative" }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.13)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 2px 16px rgba(0,0,0,0.07)"; }}>
      <div style={{ height:165, position:"relative", background:"linear-gradient(135deg,#12080A,#3D2010)", overflow:"hidden" }}>
        <img src={PHOTOS[lieu.id]?.[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.9 }} onError={e => e.target.style.display="none"} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(18,8,10,0.65) 0%,transparent 55%)" }} />
        <span style={{ position:"absolute", top:10, left:12, background:isBar?"rgba(90,50,130,0.85)":"rgba(200,145,74,0.9)", color:"#FFF", fontSize:10, padding:"3px 9px", borderRadius:10, fontWeight:700, backdropFilter:"blur(4px)" }}>{isBar?"🍸 BAR":"🍽 RESTO"}</span>
        {lieu.premium && <span style={{ position:"absolute", top:10, right:12, background:"#C8914A", color:"#FFF", fontSize:10, padding:"3px 9px", borderRadius:10, fontWeight:800 }}>PREMIUM</span>}
        <div style={{ position:"absolute", bottom:10, left:12, display:"flex", gap:6, flexWrap:"wrap" }}>
          <OpenBadge schedule={lieu.schedule} overlay />
          {hasOffers && <span style={{ background:"rgba(252,211,77,0.9)", color:"#92400E", fontSize:10, padding:"3px 8px", borderRadius:10, fontWeight:800, backdropFilter:"blur(4px)" }}>🔥 Offre</span>}
          {hasEvents && <span style={{ background:"rgba(139,92,246,0.85)", color:"#FFF", fontSize:10, padding:"3px 8px", borderRadius:10, fontWeight:800, backdropFilter:"blur(4px)" }}>📅 Event</span>}
        </div>
      </div>
      <div style={{ padding:"14px 16px" }}>
        <h3 style={{ margin:"0 0 2px", fontSize:16, fontFamily:"'Cormorant Garamond',serif", fontWeight:700, color:"#1A0A00" }}>{lieu.name}</h3>
        <span style={{ fontSize:11, color:"#AAA" }}>{lieu.type} · {lieu.arrondissement}</span>
        <div style={{ margin:"7px 0" }}><Stars note={lieu.note} /></div>
        <p style={{ fontSize:12, color:"#777", margin:"0 0 10px", lineHeight:1.55, height:48, overflow:"hidden" }}>{lieu.description}</p>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:"#AAA" }}>✨ {lieu.ambiance} · ⏱ {lieu.tempsRoute} min</span>
          <span style={{ fontSize:12, color:"#C8914A", fontWeight:800 }}>Voir →</span>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const isMobile = useIsMobile();
  const [user, setUser] = useState(null);
  const [authModal, setAuthModal] = useState(null);
  const [selectedLieu, setSelectedLieu] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("tous");
  const [activeView, setActiveView] = useState("explore");
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [lieuxSupabase, setLieuxSupabase] = useState([]);

  useEffect(() => {
    const loadEtablissements = async () => {
      const { data } = await supabase.from("etablissements").select("*");
      if (data && data.length > 0) {
        setLieuxSupabase(data.map(e => ({
          id: e.id,
          categorie: e.type?.toLowerCase().includes("bar") ? "bar" : "restaurant",
          name: e.name || "Sans nom",
          type: e.type || "",
          arrondissement: e.arrondissement || "",
          ambiance: e.ambiance || "",
          note: 4.0, tempsRoute: 10,
          adresse: e.adresse || "", tel: e.tel || "",
          priceRange: e.price_range || "€€",
          tags: [], premium: true, places: e.places || 0,
          description: e.description || "",
          coords: { lat: 48.8566, lng: 2.3522 },
          schedule: [{ days:[0,1,2,3,4,5,6], open:"09:00", close:"22:00" }],
          social: {}, menu: e.menu || [],
          offers: [], events: [], avis: [],
          photosUrls: e.photos || [],
        })));
      }
    };
    loadEtablissements();
  }, []);
  const [filters, setFilters] = useState({ type:"Tous", arr:"Tous", ambiance:"Toutes", prix:"Tous", horaire:"tous", sortBy:"note" });
  const [proOnboarding, setProOnboarding] = useState(false);
  const [toast, setToast] = useState("");
  const showToast = useCallback((msg) => setToast(msg), []);

  const handleAuth = (u) => { setUser(u); setProOnboarding(u.role==="pro" && !u.onboarded); };
  const changeView = (v) => { setActiveView(v); setSelectedCollection(null); window.scrollTo({top:0,behavior:"smooth"}); };

  if (user?.role==="pro" && proOnboarding) return <OnboardingPro user={user} onDone={(ficheData) => { user.ficheData=ficheData; user.onboarded=true; setProOnboarding(false); }} />;
  if (user?.role==="pro") return <DashboardPro user={user} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setProOnboarding(false); }} />;

  const typesOpts = activeTab==="bar" ? TYPES_BAR : TYPES_RESTAURANT;
  const ambiancesOpts = activeTab==="bar" ? AMBIANCES_BAR : AMBIANCES_RESTO;
  const resetFilters = () => setFilters({ type:"Tous", arr:"Tous", ambiance:"Toutes", prix:"Tous", horaire:"tous", sortBy:"note" });
  const hasFilter = filters.type!=="Tous"||filters.arr!=="Tous"||filters.ambiance!=="Toutes"||filters.prix!=="Tous"||filters.horaire!=="tous";

  lieuxSupabase.forEach(l => { if (l.photosUrls?.length > 0) PHOTOS[l.id] = l.photosUrls; });
  const allLieux = [...LIEUX, ...lieuxSupabase];
  const baseLieux = selectedCollection ? allLieux.filter(l => selectedCollection.ids.includes(l.id)) : allLieux;
  const filtered = baseLieux.filter(l => {
    if (activeTab!=="tous" && l.categorie!==activeTab) return false;
    if (search && ![l.name,l.type,...l.tags].join(" ").toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.type!=="Tous" && l.type!==filters.type) return false;
    if (filters.arr!=="Tous" && l.arrondissement!==filters.arr) return false;
    if (filters.ambiance!=="Toutes" && l.ambiance!==filters.ambiance) return false;
    if (filters.prix!=="Tous" && l.priceRange!==filters.prix) return false;
    if (!matchHoraire(l, filters.horaire)) return false;
    return true;
  }).sort((a,b) => filters.sortBy==="note" ? b.note-a.note : a.tempsRoute-b.tempsRoute);

  const allEvents = LIEUX.flatMap(l => (l.events||[]).map(ev => ({...ev,lieu:l})));
  const openCount = LIEUX.filter(l => (activeTab==="tous"||l.categorie===activeTab) && isOpenNow(l.schedule)).length;

  return (
    <div style={{ minHeight:"100vh", background:"#F5F2EE", fontFamily:"'Lato',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700;800&family=Lato:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
      {toast && <Toast msg={toast} onHide={() => setToast("")} />}

      <nav style={{ background:"#FFF", borderBottom:"1px solid #EDE8E0", padding:isMobile?"0 16px":"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:200, boxShadow:"0 2px 16px rgba(0,0,0,0.05)" }}>
        <Logo />
        {isMobile ? (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={() => setSurpriseOpen(true)} style={{ background:"linear-gradient(135deg,#FBF0E8,#FFF5EC)", border:"1.5px solid #E8C882", color:"#C8914A", borderRadius:20, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>🎲</button>
            {user ? <button onClick={() => setUser(null)} style={{ ...S.btnOutline, padding:"6px 12px", fontSize:12 }}>⎋</button>
                  : <button onClick={() => setAuthModal("login")} style={{ ...S.btnPrimary, padding:"6px 14px", fontSize:12 }}>Connexion</button>}
          </div>
        ) : (
          <>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              {[["explore","Explorer"],["collections","Collections"],["events","Événements"]].map(([k,l]) => (
                <button key={k} onClick={() => changeView(k)} style={{ padding:"6px 14px", borderRadius:20, border:"none", background:activeView===k?"#FBF0E8":"transparent", color:activeView===k?"#C8914A":"#888", fontWeight:activeView===k?700:400, fontSize:13, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>{l}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <button onClick={() => setSurpriseOpen(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:20, border:"1.5px solid #E8C882", background:"linear-gradient(135deg,#FBF0E8,#FFF5EC)", color:"#C8914A", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>🎲 Surprise</button>
              {user ? <>
                <span style={{ fontSize:13, color:"#888" }}>👋 {user.nom.split(" ")[0]}</span>
                <button onClick={async () => { await supabase.auth.signOut(); setUser(null); }} style={{ ...S.btnOutline, padding:"7px 14px", fontSize:12 }}>Déconnexion</button>
              </> : <>
                <button onClick={() => setAuthModal("login")} style={{ ...S.btnOutline, padding:"7px 16px", fontSize:13 }}>Connexion</button>
                <button onClick={() => setAuthModal("user")} style={{ ...S.btnPrimary, padding:"7px 16px", fontSize:13 }}>Créer un compte</button>
              </>}
            </div>
          </>
        )}
      </nav>

      {isMobile && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:200, background:"#FFF", borderTop:"1px solid #EDE8E0", display:"flex", boxShadow:"0 -4px 20px rgba(0,0,0,0.1)" }}>
          {[["explore","🔍","Explorer"],["collections","🗂","Collections"],["events","📅","Events"]].map(([k,ic,l]) => (
            <button key={k} onClick={() => changeView(k)} style={{ flex:1, padding:"10px 4px 8px", border:"none", background:"none", color:activeView===k?"#C8914A":"#AAA", fontWeight:activeView===k?700:400, fontSize:10, cursor:"pointer", fontFamily:"'Lato',sans-serif", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <span style={{ fontSize:20 }}>{ic}</span>{l}
            </button>
          ))}
        </div>
      )}

      <div style={{ background:"linear-gradient(160deg,#12080A 0%,#2D1A0E 55%,#5A3520 100%)", padding:isMobile?"36px 16px 32px":"52px 32px 44px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(ellipse at 20% 50%,rgba(200,145,74,0.12) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(100,60,140,0.08) 0%,transparent 50%)" }} />
        <div style={{ position:"relative" }}>
          <p style={{ color:"#C8914A", fontSize:12, fontWeight:700, letterSpacing:"0.2em", margin:"0 0 12px", textTransform:"uppercase" }}>✦ Paris · Restaurants & Bars sélectionnés</p>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#FFF", fontSize:isMobile?32:46, margin:"0 0 12px", lineHeight:1.15, fontWeight:700 }}>Découvrez <span style={{ color:"#E8C882" }}>l'adresse</span><br />qu'il vous faut</h1>
          <p style={{ color:"rgba(255,255,255,0.55)", fontSize:isMobile?13:15, margin:"0 0 20px" }}>{isMobile?"Restaurants & bars parisiens sélectionnés":"Des adresses triées sur le volet · Menus en ligne · Offres exclusives · Événements"}</p>
          <div style={{ maxWidth:540, margin:"0 auto", position:"relative" }}>
            <span style={{ position:"absolute", left:18, top:"50%", transform:"translateY(-50%)", fontSize:16, zIndex:1 }}>🔍</span>
            <input style={{ width:"100%", padding:"14px 20px 14px 46px", borderRadius:40, border:"none", fontSize:14, fontFamily:"'Lato',sans-serif", color:"#1A0A00", background:"#FFF", boxSizing:"border-box", boxShadow:"0 8px 32px rgba(0,0,0,0.3)", outline:"none" }}
              placeholder="Nom, cuisine, ambiance, quartier…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display:"flex", gap:14, justifyContent:"center", marginTop:18, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.08)", padding:"7px 14px", borderRadius:20, border:"1px solid rgba(255,255,255,0.12)" }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#43A047" }} />
              <span style={{ color:"rgba(255,255,255,0.8)", fontSize:12, fontWeight:600 }}>{openCount} ouvert{openCount>1?"s":""} maintenant</span>
            </div>
            <button onClick={() => setSurpriseOpen(true)} style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(200,145,74,0.2)", color:"#E8C882", border:"1px solid rgba(200,145,74,0.3)", padding:"7px 16px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>🎲 Adresse surprise</button>
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, display:"flex", alignItems:"center" }}>🍽 {LIEUX.filter(l=>l.categorie==="restaurant").length} restaurants · 🍸 {LIEUX.filter(l=>l.categorie==="bar").length} bars</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1120, margin:"0 auto", padding:isMobile?"18px 12px 80px":"26px 20px 0" }}>
        {activeView==="collections" && !selectedCollection && (
          <>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, color:"#1A0A00", margin:"0 0 6px" }}>Collections éditoriales</h2>
            <p style={{ color:"#888", fontSize:14, margin:"0 0 24px" }}>Des sélections curatées par notre équipe pour chaque occasion.</p>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(300px,1fr))", gap:isMobile?12:18, paddingBottom:40 }}>
              {COLLECTIONS.map(col => {
                const items = LIEUX.filter(l => col.ids.includes(l.id)).slice(0,3);
                return (
                  <div key={col.id} onClick={() => setSelectedCollection(col)} style={{ background:"#FFF", borderRadius:20, overflow:"hidden", cursor:"pointer", boxShadow:"0 2px 16px rgba(0,0,0,0.07)", border:"1px solid #F0EDE8", transition:"all .25s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 2px 16px rgba(0,0,0,0.07)"; }}>
                    <div style={{ height:130, display:"flex", overflow:"hidden", position:"relative" }}>
                      {items.map((l,i) => (
                        <div key={l.id} style={{ flex:1, position:"relative", overflow:"hidden" }}>
                          <img src={PHOTOS[l.id]?.[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => e.target.style.background="#3D2010"} />
                          {i<items.length-1 && <div style={{ position:"absolute", right:0, top:0, bottom:0, width:1, background:"rgba(255,255,255,0.3)" }} />}
                        </div>
                      ))}
                      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(18,8,10,0.7) 0%,transparent 60%)" }} />
                      <div style={{ position:"absolute", bottom:10, left:14, fontSize:26 }}>{col.emoji}</div>
                    </div>
                    <div style={{ padding:"14px 16px" }}>
                      <h3 style={{ margin:"0 0 4px", fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:"#1A0A00", fontWeight:700 }}>{col.titre}</h3>
                      <p style={{ margin:"0 0 8px", fontSize:12, color:"#888" }}>{col.desc}</p>
                      <span style={{ fontSize:12, color:"#C8914A", fontWeight:700 }}>{col.ids.length} adresses →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeView==="collections" && selectedCollection && (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              <button onClick={() => setSelectedCollection(null)} style={{ background:"none", border:"none", color:"#C8914A", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>← Collections</button>
              <span style={{ color:"#DDD" }}>/</span>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:"#1A0A00", fontWeight:700 }}>{selectedCollection.emoji} {selectedCollection.titre}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(300px,1fr))", gap:isMobile?14:20, paddingBottom:40 }}>
              {filtered.map(l => <Card key={l.id} lieu={l} onOpen={() => setSelectedLieu(l)} />)}
            </div>
          </>
        )}

        {activeView==="events" && (
          <>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, color:"#1A0A00", margin:"0 0 6px" }}>Événements à venir</h2>
            <p style={{ color:"#888", fontSize:14, margin:"0 0 24px" }}>Soirées, master classes, dégustations… vivez Paris autrement.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:40 }}>
              {allEvents.map((ev,i) => (
                <div key={i} style={{ background:"#FFF", borderRadius:16, overflow:"hidden", display:"flex", flexDirection:isMobile?"column":"row", boxShadow:"0 2px 16px rgba(0,0,0,0.07)", border:"1px solid #F0EDE8" }}>
                  <div style={{ width:isMobile?"100%":110, height:isMobile?120:undefined, flexShrink:0, overflow:"hidden" }}>
                    <img src={PHOTOS[ev.lieu.id]?.[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => e.target.style.background="#3D2010"} />
                  </div>
                  <div style={{ padding:"16px 20px", flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                          <span style={{ fontSize:18 }}>{ev.emoji}</span>
                          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:"#1A0A00" }}>{ev.titre}</span>
                        </div>
                        <div style={{ fontSize:12, color:"#C8914A", fontWeight:700, marginBottom:4 }}>📅 {ev.date} · {ev.lieu.name}</div>
                        <p style={{ margin:"0 0 8px", fontSize:13, color:"#666", lineHeight:1.5 }}>{ev.desc}</p>
                        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                          <span style={{ fontSize:11, color:"#7C3AED", fontWeight:600 }}>🪑 {ev.places} places</span>
                          <span style={{ fontSize:11, color:"#AAA" }}>· {ev.lieu.arrondissement}</span>
                          <OpenBadge schedule={ev.lieu.schedule} small />
                        </div>
                      </div>
                      <button onClick={() => { setSelectedLieu(ev.lieu); showToast(`Inscription à "${ev.titre}" lancée…`); }} style={{ ...S.btnPrimary, padding:"8px 16px", fontSize:12, flexShrink:0, marginLeft:16 }}>S'inscrire →</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeView==="explore" && (
          <>
            <div style={{ background:"#FFF", borderRadius:16, padding:isMobile?"12px 14px":"16px 20px", boxShadow:"0 2px 16px rgba(0,0,0,0.06)", marginBottom:16 }}>
              <div style={{ display:"flex", gap:6, marginBottom:10, alignItems:"center", overflowX:"auto", paddingBottom:2 }}>
                {[["tous","🌟 Tous"],["restaurant","🍽 Restos"],["bar","🍸 Bars"]].map(([k,l]) => (
                  <button key={k} onClick={() => { setActiveTab(k); resetFilters(); }} style={{ padding:"7px 14px", borderRadius:22, border:"1.5px solid", borderColor:activeTab===k?"#C8914A":"#E8E0D8", background:activeTab===k?"#C8914A":"#FFF", color:activeTab===k?"#FFF":"#777", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif", whiteSpace:"nowrap", flexShrink:0 }}>{l}</button>
                ))}
                <div style={{ flex:1 }} />
                {hasFilter && <button onClick={resetFilters} style={{ padding:"7px 14px", borderRadius:22, border:"1.5px solid #E8E0D8", background:"#FFF", color:"#C8914A", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>✕ Réinitialiser</button>}
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", overflowX:"auto", paddingBottom:isMobile?4:0, flexWrap:isMobile?"nowrap":"wrap" }}>
                <FilterPill label="🍴 Type" options={typesOpts} value={filters.type} onChange={v => setFilters(f => ({...f,type:v}))} />
                <FilterPill label="📍 Arrondissement" options={ARRONDISSEMENTS} value={filters.arr} onChange={v => setFilters(f => ({...f,arr:v}))} />
                <FilterPill label="✨ Ambiance" options={ambiancesOpts} value={filters.ambiance} onChange={v => setFilters(f => ({...f,ambiance:v}))} />
                <FilterPill label="📊 Trier" options={[{value:"note",label:"Mieux notés"},{value:"temps",label:"Plus proches"}]} value={filters.sortBy} onChange={v => setFilters(f => ({...f,sortBy:v}))} isObj />
                <HorairesFilter value={filters.horaire} onChange={v => setFilters(f => ({...f,horaire:v}))} />
                <div style={{ width:1, height:26, background:"#EDE8E0", margin:"0 2px" }} />
                <PriceFilter value={filters.prix} onChange={v => setFilters(f => ({...f,prix:v}))} />
              </div>
            </div>
            <p style={{ margin:"0 0 16px", fontSize:13, color:"#888" }}>
              <strong style={{ color:"#1A0A00" }}>{filtered.length}</strong> établissement{filtered.length>1?"s":""} trouvé{filtered.length>1?"s":""}
              {filters.horaire==="open_now" && <span style={{ color:"#43A047", fontWeight:700 }}> · Ouverts maintenant</span>}
            </p>
            {filtered.length===0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px" }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🔍</div>
                <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:"#888", margin:"0 0 16px" }}>Aucun résultat pour ces critères</p>
                <button onClick={resetFilters} style={S.btnOutline}>Réinitialiser les filtres</button>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(300px,1fr))", gap:isMobile?14:20, paddingBottom:40 }}>
                {filtered.map(l => <Card key={l.id} lieu={l} onOpen={() => setSelectedLieu(l)} />)}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ background:"linear-gradient(160deg,#12080A,#2D1A0E,#4A2E12)", padding:isMobile?"40px 20px":"52px 32px", textAlign:"center" }}>
        <p style={{ color:"#C8914A", fontSize:12, fontWeight:700, letterSpacing:"0.2em", textTransform:"uppercase", margin:"0 0 10px" }}>✦ Vous êtes professionnel ?</p>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#FFF", fontSize:34, margin:"0 0 10px" }}>Référencez votre établissement</h2>
        <p style={{ color:"rgba(255,255,255,0.6)", margin:"0 0 26px", fontSize:15 }}>Restaurant ou bar · <strong style={{ color:"#E8C882" }}>29€/mois · Sans engagement · Sans commission</strong></p>
        <div style={{ display:"flex", gap:20, justifyContent:"center", marginBottom:26, flexWrap:"wrap" }}>
          {(isMobile?["Menu en ligne","Offres exclusives","Événements","Badge Premium"]:["Menu en ligne","Offres exclusives","Événements","Avis vérifiés","Collections éditoriales","Badge Premium"]).map(f => (
            <span key={f} style={{ color:"rgba(255,255,255,0.65)", fontSize:13 }}>✓ {f}</span>
          ))}
        </div>
        <button onClick={() => setAuthModal("pro")} style={{ ...S.btnPrimary, padding:"13px 36px", fontSize:15 }}>Référencer mon établissement →</button>
      </div>

      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} onAuth={handleAuth} />}
      {surpriseOpen && <SurpriseModal onClose={() => setSurpriseOpen(false)} onOpen={l => { setSurpriseOpen(false); setSelectedLieu(l); }} />}
      {selectedLieu && (
        <FicheModal lieu={selectedLieu} user={user} onClose={() => setSelectedLieu(null)}
          onAuthNeeded={() => { setSelectedLieu(null); setAuthModal("user"); }}
          onReserve={async (form) => {
  await supabase.from("reservations").insert({
    etablissement_id: selectedLieu.id,
    nom: user?.nom || "Anonyme",
    date: form.date,
    couverts: form.couverts,
    message: form.message || "",
    statut: "En attente",
  });
  setConfirmation({ lieu:selectedLieu, form });
  setSelectedLieu(null);
}}
          onToast={showToast} />
      )}
      {confirmation && (
        <div style={S.overlay} onClick={() => setConfirmation(null)}>
          <div style={{ ...S.modal, maxWidth:380, textAlign:"center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#1A0A00", margin:"0 0 8px", fontSize:26 }}>Réservation envoyée !</h2>
            <p style={{ color:"#666", fontSize:14, lineHeight:1.6 }}>Votre demande chez <strong>{confirmation.lieu.name}</strong> pour le <strong>{confirmation.form.date}</strong> à <strong>{confirmation.form.heure}</strong> ({confirmation.form.couverts} pers.) a bien été transmise.</p>
            <p style={{ fontSize:12, color:"#BBB", margin:"0 0 16px" }}>Confirmation par email sous 24h · Annulation gratuite</p>
            <button onClick={() => setConfirmation(null)} style={S.btnPrimary}>Parfait 🙌</button>
          </div>
        </div>
      )}
    </div>
  );
}
