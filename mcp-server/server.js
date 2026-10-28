const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const eventService = require('../src/services/eventService');

// The lectures, read once when the server starts.
const lectures = JSON.parse(fs.readFileSync(path.join(__dirname, 'lectures.json'), 'utf8'));

// Current authenticated user session token context for MCP
let currentUser = { id: 1, email: 'member@club.com', role: 'member' };

// A tool result: one text part, and whether the tool failed.
function textResult(id, text, isError) {
  return { jsonrpc: '2.0', id: id, result: { content: [{ type: 'text', text: text }], isError: isError } };
}

// The tools this server offers. The description is what the model reads to choose.
const tools = [
  {
    name: 'find_lecture',
    description: 'Use this tool when asked about one specific lecture by number; it returns that lecture\'s title and topics.',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'integer', description: 'Lecture number, 1 to 12' } },
      required: ['number'],
    },
  },
  {
    name: 'list_lectures',
    description: 'List the number and title of every course lecture. Use it when asked what the course covers.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_events',
    description: 'Use this tool when the user asks to see upcoming club events and their free places.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_event',
    description: 'Use this tool when an organizer requests to publish a new club event with a capacity limit.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        date: { type: 'string' },
        capacity: { type: 'integer' }
      },
      required: ['title', 'date', 'capacity']
    }
  },
  {
    name: 'signup_event',
    description: 'Use this tool when a member wants to register for an available club event.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'integer' }
      },
      required: ['eventId']
    }
  }
];

// Print one reply as one line of JSON on stdout.
function send(reply) {
  process.stdout.write(JSON.stringify(reply) + '\n');
}

// Decide what to answer. Return the reply, or null to answer nothing.
async function handle(msg) {
  if (msg.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: msg.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'club-events-mcp', version: '0.1.0' },
      },
    };
  }
  if (msg.method === 'notifications/initialized') {
    return null; // a notification: it has no id and gets no reply
  }
  if (msg.method === 'tools/list') {
    return { jsonrpc: '2.0', id: msg.id, result: { tools: tools } };
  }
  if (msg.method === 'tools/call') {
    const name = msg.params.name;
    const args = msg.params.arguments || {};
    // Authentication / user session check
    const user = currentUser;
    if (!user) {
      return textResult(msg.id, 'Unauthorized: valid user token or session required', true);
    }

    if (name === 'find_lecture') {
      const lecture = lectures.find((l) => l.number === args.number);
      if (!lecture) {
        return textResult(msg.id, 'There is no lecture ' + args.number + '. The course has lectures 1 to 12.', true);
      }
      return textResult(msg.id, 'Lecture ' + lecture.number + ': ' + lecture.title + '. Topics: ' + lecture.topics, false);
    }
    if (name === 'list_lectures') {
      return textResult(msg.id, lectures.map((l) => l.number + '. ' + l.title).join('\n'), false);
    }
    if (name === 'list_events') {
      try {
        const events = await eventService.listUpcomingEvents();
        return textResult(msg.id, JSON.stringify(events), false);
      } catch (err) {
        return textResult(msg.id, err.message, true);
      }
    }
    if (name === 'create_event') {
      try {
        const result = await eventService.createNewEvent(user.id, args.title, args.description || '', args.date, args.capacity);
        if (!result.success) {
          return textResult(msg.id, result.error, true);
        }
        return textResult(msg.id, 'Event created successfully: ' + JSON.stringify(result.event), false);
      } catch (err) {
        return textResult(msg.id, err.message, true);
      }
    }
    if (name === 'signup_event') {
      try {
        const result = await eventService.signupForEvent(user.id, args.eventId);
        if (!result.success) {
          return textResult(msg.id, result.error, true);
        }
        return textResult(msg.id, 'Successfully signed up for event ID ' + args.eventId, false);
      } catch (err) {
        return textResult(msg.id, err.message, true);
      }
    }
    // A tool we never offered: the message itself is wrong, so it is a protocol error.
    return { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'Unknown tool: ' + name } };
  }
  if (msg.id !== undefined) {
    // Any other request we do not know.
    return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Unknown method: ' + msg.method } };
  }
  return null;
}

const lines = readline.createInterface({ input: process.stdin });

lines.on('line', async (line) => {
  console.error('got: ' + line);
  try {
    const reply = await handle(JSON.parse(line));
    if (reply) send(reply);
  } catch (err) {
    console.error('Error in MCP server:', err);
  }
});
