import victory from '../assets/columbia/victory.webp';
import synergy from '../assets/columbia/synergy.webp';
import nova from '../assets/columbia/nova.webp';
import victoryHome from '../assets/columbia/victory-home.webp';
import synergyHome from '../assets/columbia/synergy-home.webp';
import novaHome from '../assets/columbia/nova-home.webp';

// Supplier source and owner-confirmed reuse permission: docs/COLUMBIA-WINDOWS.md.
export const columbiaSeries = [
  {
    id: 'victory', name: 'Victory', label: 'Plan a new build',
    description: 'Columbia’s new-construction series, with sliding, single-hung, picture, and custom window options.',
    styles: 'Horizontal slider, single-hung, picture, custom',
    image: victory, photo: victoryHome,
    photoAlt: 'White windows on a modern apartment building, from Columbia’s Victory gallery.',
    imageAlt: 'Columbia Victory window rendering showing the frame and glass in profile.',
  },
  {
    id: 'synergy', name: 'Synergy', label: 'Explore everyday styles',
    description: 'A vinyl window series with familiar opening styles and choices for glass, color, and grilles.',
    styles: 'Horizontal slider, single-hung, picture, custom',
    image: synergy, photo: synergyHome,
    photoAlt: 'White windows overlooking a deck on a light-sided house, from Columbia’s Synergy gallery.',
    imageAlt: 'Columbia Synergy window rendering showing the sash and frame in profile.',
  },
  {
    id: 'nova', name: 'Nova', label: 'Choose casement or awning',
    description: 'Columbia’s casement and awning options for rooms where an outward-opening window suits the space.',
    styles: 'Casement, awning',
    image: nova, photo: novaHome,
    photoAlt: 'A row of high windows bringing daylight into an interior, from Columbia’s Nova gallery.',
    imageAlt: 'Columbia Nova window rendering showing the glass and frame in profile.',
  },
].map(series => ({ ...series, source: `https://columbia-windows.com/${series.id}-series/` }));
