import Text "mo:base/Text";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Nat "mo:base/Nat";
import Result "mo:base/Result";
import Iter "mo:base/Iter";

persistent actor class() = this {   
  
     type MemoryContent = 
        {
          #Text: Text;
          #Image: (Blob, Text);    
          #Video: (Blob, Text);
          #Audio: (Blob, Text);
          #File: (Blob, Text);
        };
     type ContentType = {
          #Text;
          #Image;
          #Video;
          #Audio;
          #File;
        };


      type Memory = {
        id: Nat;
        user: Text;
        content: MemoryContent;
        contentType: ContentType;
        summary: Text;
        timestamp: Time.Time;
        mood: Text;
      };


  type Response = Result.Result<Text, Text>;
  var memories: [Memory] = [];
  var memoryCounter: Nat = 0;

  // Emotion detection logic
  type Emotion = {
    mood: Text;
    keywords: [Text];
  };

      let emotionMap: [Emotion] = [
          { mood = "Happy"; keywords = ["happy", "joy", "excited", "grateful", "love", "joyful", "excitement", "loving", "amazing", "wonderful", "fantastic", "great", "awesome", "bliss", "cheerful", "delighted", "ecstatic", "euphoric", "jubilant", "thrilled", "content", "pleased", "satisfied"] },
          { mood = "Sad"; keywords = ["sad", "lonely", "depressed", "cry", "miss", "hate", "not happy", "bad", "sadness", "loneliness", "depression", "crying", "missing", "heartbroken", "unhappy", "miserable", "gloomy", "hopeless", "sorrow", "tearful", "upset", "disappointed", "regret"] },
          { mood = "Angry"; keywords = ["angry", "mad", "frustrated", "annoyed", "anger", "furious", "frustration", "annoyance", "irritated", "irritation", "rage", "outraged", "resentful", "bitter", "aggravated", "hostile", "infuriated", "livid", "enraged", "fuming", "seething"] },
          { mood = "Anxious"; keywords = ["anxious", "nervous", "worried", "panic", "anxiety", "nervousness", "worry", "panicked", "stressed", "stress", "overwhelmed", "tense", "uneasy", "apprehensive", "fearful", "frightened", "scared", "terrified", "dread", "restless", "jittery", "on edge"] },
          { mood = "Surprised"; keywords = ["surprised", "shocked", "astonished", "amazed", "astounded", "stunned", "startled", "bewildered", "dumbfounded", "flabbergasted", "taken aback", "surprise"] },
          { mood = "Disgusted"; keywords = ["disgusted", "repulsed", "revolted", "sickened", "appalled", "horrified", "nauseated", "offended", "grossed out", "disgust"] },
          { mood = "Confused"; keywords = ["confused", "puzzled", "perplexed", "baffled", "bewildered", "disoriented", "muddled", "uncertain", "unsure", "hesitant", "confusion"] },
          { mood = "Excited"; keywords = ["excited", "eager", "enthusiastic", "pumped", "thrilled", "elated", "jubilant", "energized", "animated", "vibrant", "exhilarated", "excitement"] },
          { mood = "Tired"; keywords = ["tired", "exhausted", "fatigued", "weary", "drained", "sleepy", "lethargic", "burnt out", "worn out", "spent", "run down"] },
          { mood = "Peaceful"; keywords = ["peaceful", "calm", "serene", "tranquil", "relaxed", "content", "at ease", "comfortable", "placid", "untroubled", "still", "quiet"] },
          { mood = "Hopeful"; keywords = ["hopeful", "optimistic", "encouraged", "positive", "confident", "assured", "upbeat", "bright", "promising", "sanguine", "hope"] },
          { mood = "Grateful"; keywords = ["grateful", "thankful", "appreciative", "blessed", "fortunate", "lucky", "indebted", "obliged", "content", "satisfied"] },
          { mood = "Bored"; keywords = ["bored", "boring", "uninterested", "indifferent", "apathetic", "uninspired", "dull", "tedious", "monotonous", "repetitive"] },
          { mood = "Proud"; keywords = ["proud", "accomplished", "achieved", "successful", "confident", "self-satisfied", "dignified", "honored", "pleased", "pride"] },
          { mood = "Jealous"; keywords = ["jealous", "envious", "covetous", "resentful", "bitter", "green-eyed", "insecure", "possessive", "suspicious"] },
          { mood = "Guilty"; keywords = ["guilty", "remorseful", "regretful", "ashamed", "sorry", "contrite", "repentant", "penitent", "self-reproachful"] },
          { mood = "Lonely"; keywords = ["lonely", "isolated", "alone", "abandoned", "forsaken", "neglected", "unloved", "friendless", "solitary", "detached"] },
          { mood = "Loved"; keywords = ["loved", "cherished", "adored", "treasured", "valued", "precious", "beloved", "dear", "special", "important"] },
          { mood = "Curious"; keywords = ["curious", "inquisitive", "interested", "nosy", "prying", "questioning", "wondering", "eager", "intrigued"] },
          { mood = "Motivated"; keywords = ["motivated", "determined", "driven", "ambitious", "inspired", "focused", "committed", "persistent", "goal-oriented"] }
      ];

  func detectMood(text: Text): Text {
    for (e in emotionMap.vals()) {
      for (k in e.keywords.vals()) {
        if (Text.contains(text, #text(k))) {
          return e.mood;
        };
      };
    };
    return "Neutral";
  };

  func generateSummary(text: Text): Text {
    let tokens = Text.tokens(text, #char ' ');
    let words = Iter.toArray(tokens);
    let limit = if (words.size() > 10) { 10 } else { words.size() };
    let preview = Array.slice(words, 0, limit);
    Text.join(" ", preview) # (if (words.size() > 10) { "..." } else { "" });
  };

     public func saveMemory(
          user: Text,
          content: MemoryContent,
          contentType: ContentType
        ): async Response {
          let textContent = switch (content) {
            case (#Text(txt)) txt;
            case (#Image(_, txt)) txt;
            case (#Video(_, txt)) txt;
            case (#Audio(_, txt)) txt;
            case (#File(_, txt)) txt;
          };

          if (Text.size(Text.trim(user, #char ' ')) == 0 or Text.size(Text.trim(textContent, #char ' ')) == 0) {
            return #err("❌ Username and memory description must not be empty.");
          };

          let newMemory: Memory = {
            id = memoryCounter;
            user = user;
            content = content;
            contentType = contentType;
            summary = generateSummary(textContent);
            timestamp = Time.now();
            mood = detectMood(textContent);
          };

          memories := Array.append<Memory>(memories, [newMemory]);
          memoryCounter += 1;
          return #ok("✅ Memory saved.");
        };

  public query func getMemoriesByUser(user: Text): async [Memory] {
    Array.filter<Memory>(memories, func(m) = m.user == user);
  };

        public func editMemory(
          id: Nat,
          newContent: Text,
          newContentType: ContentType
        ): async Response {
          var found = false;

          memories := Array.map<Memory, Memory>(memories, func(m) {
            if (m.id == id) {
              found := true;
              {
                id = m.id;
                user = m.user;
                content = #Text(newContent); // ✅ wrap as MemoryContent
                contentType = newContentType;
                summary = generateSummary(newContent);
                timestamp = Time.now();
                mood = detectMood(newContent);
              }
            } else {
              m
            }
          });

          if (found) {
            return #ok("✅ Memory updated.");
          } else {
            return #err("❌ Memory not found.");
          };
        };



  public func deleteMemory(id: Nat): async Response {
    let initialLen = memories.size();
    memories := Array.filter<Memory>(memories, func(m) = m.id != id);
    if (memories.size() < initialLen) {
      return #ok("🗑️ Memory deleted.");
    } else {
      return #err("❌ Memory not found.");
    };
  };

      public query func searchMemories(user: Text, keyword: Text): async [Memory] {
        let pattern: Text.Pattern = #text(keyword);
        Array.filter<Memory>(memories, func(m: Memory): Bool {
          if (m.user != user) return false;

          let contentText = switch (m.content) {
            case (#Text(txt)) txt;
            case (#Image(_, txt)) txt;
            case (#Video(_, txt)) txt;
            case (#Audio(_, txt)) txt;
            case (#File(_, txt)) txt;
          };

          Text.contains(contentText, pattern)
        });
      };


  // ✅ NEW: Filter memories by date range
  public query func filterMemoriesByDate(user: Text, start: Time.Time, end: Time.Time): async [Memory] {
    Array.filter<Memory>(memories, func(m: Memory): Bool {
      m.user == user and m.timestamp >= start and m.timestamp <= end
    });
  };

  // ✅ NEW: Count number of memories by mood for a user
  public query func countMemoriesByMood(user: Text): async [(Text, Nat)] {
    var moodMap: [(Text, Nat)] = [];
    for (m in memories.vals()) {
      if (m.user == user) {
        let existing = Array.find<(Text, Nat)>(moodMap, func(x) = x.0 == m.mood);
        switch (existing) {
          case (?_match) {
            moodMap := Array.map<(Text, Nat), (Text, Nat)>(moodMap, func(x) {
              if (x.0 == m.mood) { (x.0, x.1 + 1) } else x
            });
          };
          case null {
            moodMap := Array.append(moodMap, [(m.mood, 1)]);
          };
        };
      };
    };
    return moodMap;
  };

  system func preupgrade() {};
  system func postupgrade() {
    memoryCounter := Array.foldLeft<Memory, Nat>(memories, 0, func(acc, m) {
      if (m.id >= acc) { m.id + 1 } else { acc }
    });
  };
};
