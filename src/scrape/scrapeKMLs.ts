import {RouteV2} from '../types/RouteV2';
// @ts-ignore
import TJ from '@mapbox/togeojson';
import xmldom from '@xmldom/xmldom';
import {cloneDeep, keyBy} from 'lodash';
import {logger} from '../logger';
import cachedFetch from './cachedFetch';
import {validate} from './getValidator';

const limit = 100;

/**
 * Take an array of `RouteV2`s and a list of their RopeWiki regions, scrape their KMLs,
 * and return a new array of routes with the "geojson" property populated.
 */
export async function scrapeKMLs(
  routes: RouteV2[],
  {regions}: {regions: string[]},
): Promise<RouteV2[]> {
  const lookup = keyBy(cloneDeep(routes), 'name');

  for (const region of regions) {
    let offset = 0;

    while (true) {
      const url1 = new URL(`http://ropewiki.com/index.php/KMLList`);
      url1.searchParams.append('offset', `${offset}`);
      url1.searchParams.append('limit', `${limit}`);
      url1.searchParams.append('action', `raw`);
      url1.searchParams.append('templates', `expand`);
      url1.searchParams.append('ctype', `application/x-zope-edit`);
      url1.searchParams.append('numname', `on`);
      url1.searchParams.append('group', `link`);
      url1.searchParams.append(
        'query',
        decodeURIComponent(
          `%5B%5BCategory%3ACanyons%5D%5D%5B%5BLocated%20in%20region.Located%20in%20regions%3A%3AX%7C%7C${region}%5D%5D`,
        ),
      );
      url1.searchParams.append('sort', decodeURIComponent(`Has_rank_rating%2C%20Has_name`));
      url1.searchParams.append('order', decodeURIComponent(`descending%2C%20ascending`));
      url1.searchParams.append('gpx', `off`);
      url1.searchParams.append('mapnum', ``);
      url1.searchParams.append('mapname', `off`);
      url1.searchParams.append('mapdata', ``);
      url1.searchParams.append('maploc', ``);
      url1.searchParams.append('maplinks', ``);
      url1.searchParams.append('allmap', ``);
      url1.searchParams.append('qname', region);
      url1.searchParams.append('filename', region);
      url1.searchParams.append('ext', `.kml`);

      const url = new URL('https://ropewiki.com/luca/rwr');
      url.searchParams.append('gpx', 'off');

      let text = await cachedFetch(new URL(`${url.toString()}&kml=${url1.toString()}`));

      // Sometimes the document is missing a KML end tag. This hack seems to always fix it.
      if (!text.trim().endsWith('</kml>')) {
        text += '</kml>';
      }

      const document = new xmldom.DOMParser().parseFromString(text);
      const els = Array.from(document.getElementsByTagName('Document'));

      if (els.length === 1) break;

      for (const el of els) {
        const name = el.previousSibling?.previousSibling?.textContent?.trim();

        if (!name) continue;
        if (name === 'Ropewiki Map Export') continue;

        const route = lookup[name];
        if (!route) continue;

        logger.verbose(`Got KML for ${name}`);
        route.geojson = TJ.kml(el, {styles: true});

        validate('RouteV2', route);
      }

      offset += els.length;
    }
  }

  return Object.values(lookup);
}
