/**
 * Claims from published reporting, each paired with the sentence we test.
 * "said" paraphrases the source; it never quotes more than a few words.
 * Verdicts are computed live from the data, never written here.
 */
export const NEWS = [
  {
    id: 'balochistan-2022',
    outlet: 'Dawn',
    date: '7 Jul 2022',
    url: 'https://www.dawn.com/news/1698641',
    said: 'Balochistan’s monsoon rain ran 274% above average in early July. Pasni and Turbat flooded.',
    test: 'Rain in Balochistan is getting more erratic',
    note: 'Around Pasni, average rain shows no significant change since 2000. Month-to-month swings have grown about 51% a decade. July 2022 averaged 7.1 mm a day, against 0.8 in a usual July.',
    event: { area: 181, record: 'PRECTOTCORR', date: '2022-07', label: 'July 2022 floods' },
  },
  {
    id: 'turkana-2023',
    outlet: 'REACH',
    date: '2023',
    url: 'https://repository.impact-initiatives.org/document/reach/574d49ab/REACH_KEN2303_Impacts-of-climatic-shocks-on-communities-1.pdf',
    said: 'Turkana went from failed rains in 2020–22 to a long rainy season far wetter than normal in 2023.',
    test: 'Floods in Turkana are getting more extreme',
    note: 'Around Lodwar, runoff swings have grown about 31% a decade, with no significant change in the average. GPM satellite rain shows the same pattern.',
    event: { area: 213, record: 'runoff', date: '2023-04', label: '2023 long rains' },
  },
  {
    id: 'libya-2023',
    outlet: 'The National, on World Weather Attribution',
    date: '19 Sep 2023',
    url: 'https://www.thenationalnews.com/world/uk-news/2023/09/19/climate-change-made-libya-flooding-50-times-more-likely',
    said: 'Climate change made the rain behind Storm Daniel’s floods in Libya up to 50 times more likely.',
    test: 'Rain in eastern Libya is getting more extreme',
    note: 'This tool doesn’t test the cause of a single storm. It tests the swings in eastern Libya’s rain: they grew significantly in 2 of 3 areas, and the average shows no significant change.',
  },
  {
    id: 'zambia-2024',
    outlet: 'Save the Children',
    date: '3 Apr 2024',
    url: 'https://www.savethechildren.org/us/about-us/media-and-news/2024-press-releases/children-surviving-on-boiled-waterlily-roots-and-wild-fruits',
    said: 'Zambia is living through its worst drought in at least 20 years.',
    test: 'Zambia is drying out',
    note: 'Since 2000, neither Zambian area shows a significant drying trend, and one is significantly wetter. World Weather Attribution found El Niño was the main driver of the 2024 drought.',
    noteUrl: 'https://www.worldweatherattribution.org/el-nino-key-driver-of-drought-in-highly-vulnerable-southern-african-countries/',
  },
  {
    id: 'australia-2024',
    outlet: 'CSIRO and Bureau of Meteorology',
    date: 'Nov 2024',
    url: 'https://www.csiro.au/en/news/All/Articles/2024/November/State-of-the-Climate',
    said: 'Rainfall is falling in southern Australia and rising in the north.',
    test: 'Northern Australia is getting wetter',
    note: 'The report measures from 1994 and earlier. From 2000, both NASA rain records show northern Australia trending drier, significantly in 3 of 9 areas. The start year changes the result.',
  },
  {
    id: 'somalia-2019',
    outlet: 'The New Humanitarian, quoting UN OCHA',
    date: '19 Nov 2019',
    url: 'https://www.thenewhumanitarian.org/feature/2019/11/19/Climate-shocks-Somalia-problems',
    said: 'Droughts in Somalia have grown more intense and more frequent over 30 years.',
    test: 'Droughts in Somalia are getting worse',
    note: 'Of Somalia’s 3 areas, one has significantly drier topsoil, one about 530 km away has significantly wetter topsoil, and one shows no clear change.',
  },
];
