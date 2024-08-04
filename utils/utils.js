// replaces https://k6.io/docs/javascript-api/jslib/utils/

export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  export function randomIntBetween(min, max) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  
  export function randomItem(arrayOfItems){
    return arrayOfItems[Math.floor(Math.random() * arrayOfItems.length)];
  }
  
  export function randomString(length, charset='abcdefghijklmnopqrstuvwxyz') {
    let res = '';
    while (length--) res += charset[(Math.random() * charset.length) | 0];
    return res;
  }

  export function randomDate(start, end) {
    const startDate = new Date(start); // Start date
    const endDate = new Date(end);   // End date
    // Convert dates to timestamps
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();
    // Generate a random timestamp between start and end
    const randomTimestamp = startTimestamp + Math.random() * (endTimestamp - startTimestamp);
    // Convert the random timestamp back to a date
    const randomDate = new Date(randomTimestamp);
    return randomDate.toISOString().split('T')[0];
  }
  
  export function findBetween(content, left, right, repeat = false) {
    const extracted = [];
    let doSearch = true;
    let start, end = 0;
    
    while (doSearch) {
      start = content.indexOf(left);
      if (start == -1) {
        break; // no more matches
      }
  
      start += left.length;
      end = content.indexOf(right, start);
      if (end == -1) {
        break; // no more matches
      }
      let extractedContent = content.substring(start, end);
  
      // stop here if only extracting one match (default behavior)
      if (!repeat) {
        return extractedContent; 
      }
  
      // otherwise, add it to the array
      extracted.push(extractedContent);
      
      // update the "cursor" position to the end of the previous match
      content = content.substring(end + right.length);
    }
  
    return extracted.length ? extracted : null; // return all matches as an array or null
  }

  export function getEnvVar(key, defaultValue = 'NOT_PASSED') {
    return __ENV[key] ? __ENV[key] : defaultValue;
}