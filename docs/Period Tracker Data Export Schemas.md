While actual mock export files provided directly by Clue or Flo are not publicly hosted due to the sensitive nature of the data, the open-source developer community has reverse-engineered their structures to build data migration tools.

Based on these open-source parsers and conversion scripts, here are the explicit schema definitions, data structures, and links to the repositories you can use to build your `ImportService`.

### **1\. Clue Data Export (`.cluedata`/ JSON)**

**Schema Structure:** A Clue export file is a JSON document that relies on a root array identified by the key `data`. The parser logic iterates through this array, where each node represents a chronological day containing polymorphic key-value pairs.

**Explicit Key Definitions:** According to open-source mapping rules used to convert Clue data to other applications, Clue uses highly specific, path-like string tags to categorize entries. Some of the exact keys you will need to map in your `parseClueCSV/JSON` function include:

* **Bleeding & Flow:** `period/light`, `period/medium`, `period/heavy`, `period/very_heavy`, and `spotting`.

* **Cervical Fluid:** `discharge/none`, `discharge/sticky`, `discharge/creamy`, and `discharge/egg_white`.

* **Measurements:** `bbt` (Basal Body Temperature).

**Open-Source Parsers & Schema References:**

* **([https://github.com/fabfabretti/clue-to-drip/blob/main/conversionrules.md](https://github.com/fabfabretti/clue-to-drip/blob/main/conversionrules.md)):** This repository explicitly maps Clue's proprietary JSON keys (like `period/heavy` and `bbt`) to standard numerical values.

* **([https://github.com/isosphere/Clue-Period-Tracker-Backup-Converter/blob/master/clue-to-excel.py](https://github.com/isosphere/Clue-Period-Tracker-Backup-Converter/blob/master/clue-to-excel.py)):** This script reveals the exact iteration logic (`for day in structure\['data'\]: for key in day.keys():`) required to flatten Clue's nested JSON structure into tabular rows.

### **2\. Flo Data Export (JSON)**

**Schema Structure:** Flo's official documentation defines its export as a "portable format file (JSON) that contains a list of digital values without any graphical information". Unlike Clue's nested day-objects, Flo outputs an event stream—a flat list of events mapped to timestamps.

**Open-Source Parsers & Schema References:**

* **([https://github.com/SaraVieira/flo-to-drip](https://github.com/SaraVieira/flo-to-drip)):** This open-source JavaScript tool was built specifically to upload a Flo export JSON file, parse its "digital values" list, and convert it into a standardized tabular format. You can inspect the `main.js` files within this repository to see exactly how Flo's JSON nodes are targeted and extracted in a web environment.

To test your `ImportService.clue.test.ts` and `ImportService.flo.test.ts` files, you can safely synthesize mock JSON payloads by replicating the data array structure and utilizing the exact string tags (like `period/very_heavy`) found in the `fabfabretti` and `SaraVieira` repositories.

