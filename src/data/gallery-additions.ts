import landscapedTriple from '../assets/work/gallery-landscaped-triple.jpg';
import gardenChimney from '../assets/work/gallery-garden-chimney.jpg';
import gardenGrids from '../assets/work/gallery-garden-grids.jpg';
import blueTransoms from '../assets/work/gallery-blue-transoms.jpg';
import woodSide from '../assets/work/gallery-wood-side.jpg';
import woodWindow from '../assets/work/gallery-wood-window.jpg';
import brightSunroom from '../assets/work/gallery-bright-sunroom.jpg';
import cornerRoom from '../assets/work/gallery-corner-room.jpg';
import emptyCorner from '../assets/work/gallery-empty-corner.jpg';
import kitchenPair from '../assets/work/gallery-kitchen-pair.jpg';
import kitchenCorner from '../assets/work/gallery-kitchen-corner.jpg';
import deckView from '../assets/work/gallery-deck-view.jpg';
import patioSlider from '../assets/work/tan-siding-patio-slider.jpg';
import darkHouseSliderBlueSky from '../assets/work/gallery-dark-house-slider-blue-sky.jpg';
import darkFrameSliderTanDeck from '../assets/work/gallery-dark-frame-slider-tan-deck.jpg';
import tallWindowSidingCorner from '../assets/work/gallery-tall-window-siding-corner.jpg';
import tallWindowsBlackFrames from '../assets/work/gallery-tall-windows-black-frames.jpg';
import greenTrimEntrySkylight from '../assets/work/gallery-green-trim-entry-skylight.jpg';
import darkHouseSquareSlider from '../assets/work/gallery-dark-house-square-slider.jpg';
import tealWallGardenSlider from '../assets/work/gallery-teal-wall-garden-slider.jpg';
import kitchenSliderPergola from '../assets/work/gallery-kitchen-slider-pergola.jpg';
import tanSidingDoubleHungPair from '../assets/work/gallery-tan-siding-double-hung-pair.jpg';

/**
 * The sliding glass door shown on the home page's "Sliding glass doors" tile and as the
 * /sliding-glass-doors hero background (2026-10-11 batch, docs/GALLERY-PHOTOS-2026-10-11.md).
 *
 * It lives here, not in workPhotos, on purpose: workPhotos feeds the "Finished result" groups,
 * the replacement page and the "Real installs" grid, and each of those says the job was ours.
 * This batch's provenance is not confirmed yet (VERIFY with Mark), so the photo carries only a
 * visual description. A person visible through the glass was retouched out (see the doc).
 */
export const patioSliderPhoto = {
  image: patioSlider,
  alt: 'Sliding glass door with a white frame and one panel slid partly open, on a tan lap-siding house above a paver patio',
  caption: 'Sliding glass door onto the patio',
};

// Gallery-only additions: existing workPhotos, service-page selections and hero stay intact.
// Captions describe what is in the picture; none of them claim a scope of work or a job type.
export const galleryAdditions = [
  { image: landscapedTriple, alt: 'White three-panel window on a light-sided home above a landscaped garden', caption: 'Three-panel window above the garden' },
  { image: gardenChimney, alt: 'White-trimmed window beside a brick chimney, green siding and blue hydrangeas', caption: 'Garden window beside the chimney' },
  { image: gardenGrids, alt: 'Gridded white window on a light-sided home surrounded by green shrubs under a blue sky', caption: 'Gridded window and garden view' },
  { image: blueTransoms, alt: 'Tall white-trimmed windows with rectangular transoms on a blue-sided home', caption: 'Tall windows with transoms' },
  { image: woodSide, alt: 'White-trimmed windows along a wood-sided home beside a green garden', caption: 'Windows on a wood-sided home' },
  { image: woodWindow, alt: 'Wide white three-panel window beneath an exposed timber roof on a wood-sided home', caption: 'Three-panel window beneath timber beams' },
  { image: brightSunroom, alt: 'Bright sitting room with a large window between two narrow windows and a vaulted ceiling', caption: 'Light-filled sitting room' },
  { image: cornerRoom, alt: 'White-trimmed windows around the corner of an empty room with a gray carpet', caption: 'Windows around the room' },
  { image: emptyCorner, alt: 'Two white-trimmed windows meeting at the corner of a room with a wood floor', caption: 'Corner windows and natural light' },
  { image: kitchenPair, alt: 'White-trimmed tall window beside a wider window in a light-colored kitchen', caption: 'Kitchen windows from inside' },
  { image: kitchenCorner, alt: 'White corner windows above a kitchen sink and dark wood cabinets', caption: 'Corner windows above the kitchen sink' },
  { image: deckView, alt: 'White-trimmed window seen from inside a room overlooking a covered deck and green trees', caption: 'Looking out onto the deck' },
  // 2026-10-11 batch (IMG_20261010_*): 4K upscales of the originals, ordered like the first batch,
  // clear exteriors first, then details, then bright interiors.
  patioSliderPhoto,
  { image: darkHouseSliderBlueSky, alt: 'White-framed sliding window on a dark-painted house under a clear blue sky, beside a tall evergreen shrub', caption: 'Sliding window on a dark house' },
  { image: darkFrameSliderTanDeck, alt: 'Dark bronze-framed sliding window on tan lap siding beside a downspout, above a painted deck', caption: 'Dark-framed slider above the deck' },
  { image: tallWindowsBlackFrames, alt: 'Looking up at black-framed windows on a tall tan lap-siding wall, a two-part window above a large picture window, under a blue sky', caption: 'Black-framed windows on a tall wall' },
  { image: greenTrimEntrySkylight, alt: 'Front entry of a cream lap-siding house with green trim, a white-framed window beside the door, a skylight on the roof and trimmed shrubs under a blue sky', caption: 'Window beside the front entry' },
  { image: darkHouseSquareSlider, alt: 'White-trimmed square sliding window centered on a dark-painted wall beneath a roof overhang, with a tall evergreen behind', caption: 'Square slider on a dark wall' },
  { image: tallWindowSidingCorner, alt: 'Tall narrow dark-framed window at the corner of a tan lap-siding house, beside a wider sliding window and a white deck', caption: 'Tall window at the siding corner' },
  { image: tanSidingDoubleHungPair, alt: 'Pair of white two-sash windows with wide trim on tan lap siding under a gray sky', caption: 'Window pair on tan siding' },
  { image: tealWallGardenSlider, alt: 'White-framed sliding window with wide trim on a deep teal interior wall, looking out at a rose shrub and a neighboring wall', caption: 'Slider from inside, garden view' },
  { image: kitchenSliderPergola, alt: 'White-framed sliding window above a kitchen sink on a yellow wall, looking out to a green lawn and a wood pergola', caption: 'Kitchen slider with a backyard view' },
];
