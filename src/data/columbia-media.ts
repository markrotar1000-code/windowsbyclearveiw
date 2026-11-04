import corner from '../assets/columbia/victory-corner.webp';
import section from '../assets/columbia/victory-section.webp';
import chambers from '../assets/columbia/chamber-section.jpeg';
import rail from '../assets/columbia/meeting-rail.jpg';
import weatherstrip from '../assets/columbia/weatherstripping.jpg';
import vent from '../assets/columbia/vent-stop.jpg';
import slider from '../assets/columbia/style-slider.webp';
import singleHung from '../assets/columbia/style-single-hung.webp';
import picture from '../assets/columbia/style-picture.webp';
import custom from '../assets/columbia/style-custom.webp';
import casement from '../assets/columbia/style-casement.webp';
import awning from '../assets/columbia/style-awning.webp';
import colonial from '../assets/columbia/grille-colonial.jpg';
import prairie from '../assets/columbia/grille-prairie.jpg';
import topDown from '../assets/columbia/grille-top-down.jpg';
import flat from '../assets/columbia/grille-flat.png';
import sculpturedSmall from '../assets/columbia/grille-sculptured-small.png';
import sculpturedLarge from '../assets/columbia/grille-sculptured-large.png';
import factoryWindows from '../assets/columbia/factory-windows.webp';
import factoryFloor from '../assets/columbia/factory-floor.webp';

// Original supplier media and source URLs: docs/COLUMBIA-WINDOWS.md.
export const frameMedia = [
  { image: corner, title: 'Victory corner detail', alt: 'Columbia Victory corner cutaway showing the glass, sash, and frame.', detail: 'See how the glass and frame meet in Columbia’s Victory rendering.' },
  { image: section, title: 'Victory frame cross-section', alt: 'Cross-section through the Columbia Victory frame and sash with internal chambers visible.', detail: 'A closer view of the frame, sash, and internal chambers.' },
  { image: chambers, title: 'Chambered construction', alt: 'Columbia window profile cutaway with multiple chambers and visible internal components.', detail: 'Columbia’s construction detail shows the spaces within the vinyl profile.' },
  { image: rail, title: 'Reinforced meeting rail', alt: 'Cutaway of a window meeting rail showing a metal reinforcement inside the profile.', detail: 'The meeting rail is where the sashes meet. Columbia lists metal reinforcement on its series pages.' },
  { image: weatherstrip, title: 'Gold Series weatherstripping', alt: 'Close-up of a curved strip of white pile weatherstripping.', detail: 'A close-up of the material Columbia describes in its weatherstripping options.' },
  { image: vent, title: 'Vent stop detail', alt: 'Close-up of a vent stop fitted to a white window frame.', detail: 'Hardware pictured on Columbia’s site. Ask which hardware comes with your selected window.' },
];

export const styleMedia = [
  { image: slider, title: 'Horizontal slider', alt: 'Front-view illustration of a three-panel horizontal sliding window.', detail: 'Victory & Synergy · A sash slides sideways.' },
  { image: singleHung, title: 'Single-hung', alt: 'Front-view illustration of a single-hung window with the lower sash raised.', detail: 'Victory & Synergy · The lower sash moves vertically.' },
  { image: picture, title: 'Picture', alt: 'Front-view illustration of a fixed picture window.', detail: 'Victory & Synergy · Fixed glass for a clear view.' },
  { image: custom, title: 'Custom shapes', alt: 'Illustration of a peaked window arrangement with rectangular and angled units.', detail: 'Victory & Synergy · Explore shapes and combinations for your opening.' },
  { image: casement, title: 'Casement', alt: 'Illustration of a side-hinged casement window with its sash open.', detail: 'Nova · Hinged at the side and opens outward.' },
  { image: awning, title: 'Awning', alt: 'Illustration of an awning window with an arrow showing its outward opening.', detail: 'Nova · Hinged at the top and opens outward.' },
];

export const grilleMedia = [
  { image: colonial, title: 'Colonial', alt: 'Colonial grille pattern with three columns and two rows.', detail: 'A regular grid across the glass.' },
  { image: prairie, title: 'Prairie', alt: 'Prairie grille pattern with lines close to the glass perimeter.', detail: 'A border pattern around the glass.' },
  { image: topDown, title: 'Top down', alt: 'Top-down grille pattern dividing the upper portion of the glass.', detail: 'Grille detail concentrated at the top.' },
  { image: flat, title: '5/8″ flat', alt: 'Close-up of the intersection of a flat grille profile.', detail: 'Flat grille profile.' },
  { image: sculpturedSmall, title: '5/8″ sculptured', alt: 'Close-up of a narrow sculptured grille profile.', detail: 'Contoured grille profile.' },
  { image: sculpturedLarge, title: '1″ sculptured', alt: 'Close-up of a wide sculptured grille profile.', detail: 'Wider contoured grille profile.' },
];

export const factoryMedia = [
  { image: factoryWindows, title: 'Windows on the factory floor', alt: 'Window units and production equipment inside Columbia’s factory.', detail: 'Columbia’s own manufacturing photo.', photo: true },
  { image: factoryFloor, title: 'Inside the production space', alt: 'A wide view of window production equipment and racks inside Columbia’s factory.', detail: 'Columbia’s own manufacturing photo.', photo: true },
];
