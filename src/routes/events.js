const express = require('express');
const router = express.Router();
const eventService = require('../services/eventService');
const fs = require('fs');
const path = require('path');

const eventsHtmlPath = path.join(__dirname, '../views/events.html');
const createEventHtmlPath = path.join(__dirname, '../views/create-event.html');

router.get('/events', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  try {
    const events = await eventService.listUpcomingEvents();
    const userRegistrations = await eventService.getUserRegistrations(req.session.user.id);
    let html = fs.readFileSync(eventsHtmlPath, 'utf8');

    html = html.replace('{{user_email}}', escapeHtml(req.session.user.email));
    html = html.replace('{{user_role}}', escapeHtml(req.session.user.role));

    const error = req.query.error;
    const success = req.query.success;
    let messageHtml = '';
    if (error) {
      messageHtml += `<div class="error-msg">${escapeHtml(error)}</div>`;
    }
    if (success) {
      messageHtml += `<div class="success-msg">${escapeHtml(success)}</div>`;
    }
    html = html.replace('{{message_html}}', messageHtml);

    let organizerActionsHtml = '';
    if (req.session.user.role === 'organizer') {
      organizerActionsHtml = `
        <div style="margin-bottom: 1.5rem;">
          <a href="/events/new" class="btn btn-success">+ Create New Event</a>
        </div>
      `;
    }
    html = html.replace('{{organizer_actions_html}}', organizerActionsHtml);

    let eventsListHtml = '';
    if (events.length === 0) {
      eventsListHtml = '<p>No upcoming events available.</p>';
    } else {
      eventsListHtml = events.map(event => {
        const isRegistered = userRegistrations.has(event.id);
        const freePlaces = Number(event.free_places);
        const isFull = freePlaces <= 0;
        const isOwner = event.organizer_id === req.session.user.id;

        let actionButton = '';
        if (req.session.user.role === 'member') {
          if (isRegistered) {
            actionButton = `
              <form action="/events/${event.id}/cancel" method="POST" style="margin-top: 1rem;">
                <button type="submit" class="btn btn-danger">Cancel registration</button>
              </form>
            `;
          } else if (isFull) {
            actionButton = `
              <div style="margin-top: 1rem;">
                <button type="button" class="btn btn-disabled" disabled>Event Full</button>
              </div>
            `;
          } else {
            actionButton = `
              <form action="/events/${event.id}/signup" method="POST" style="margin-top: 1rem;">
                <button type="submit" class="btn btn-success">Sign Up</button>
              </form>
            `;
          }
        } else if (req.session.user.role === 'organizer' && isOwner) {
          actionButton = `
            <form action="/events/${event.id}/delete" method="POST" style="margin-top: 1rem;">
              <button type="submit" class="btn btn-danger" onclick="return confirm('Are you sure you want to delete this event?');">Delete Event</button>
            </form>
          `;
        }

        return `
          <div class="event-card">
            <h2 class="event-title">${escapeHtml(event.title)}</h2>
            <div class="event-meta">
              <span>📅 Date: ${new Date(event.date).toLocaleString()}</span> | 
              <span>🪑 Free Places: <strong>${freePlaces}</strong> / ${event.capacity}</span>
            </div>
            <p class="event-desc">${escapeHtml(event.description || '')}</p>
            ${actionButton}
          </div>
        `;
      }).join('');
    }

    html = html.replace('{{events_list_html}}', eventsListHtml);
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/events/new', (req, res) => {
  if (!req.session || !req.session.user || req.session.user.role !== 'organizer') {
    return res.status(403).send('Forbidden');
  }
  let html = fs.readFileSync(createEventHtmlPath, 'utf8');
  const error = req.query.error;
  const errorHtml = error ? `<div class="error">${escapeHtml(error)}</div>` : '';
  html = html.replace('{{error_html}}', errorHtml);
  res.send(html);
});

router.post('/events', async (req, res) => {
  if (!req.session || !req.session.user || req.session.user.role !== 'organizer') {
    return res.status(403).send('Forbidden');
  }
  try {
    const { title, description, date, capacity } = req.body;
    const result = await eventService.createNewEvent(
      req.session.user.id,
      title,
      description,
      date,
      parseInt(capacity, 10)
    );
    if (!result.success) {
      return res.redirect('/events/new?error=' + encodeURIComponent(result.error));
    }
    res.redirect('/events?success=' + encodeURIComponent('Event created successfully'));
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/events/:id/signup', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  try {
    const result = await eventService.signupForEvent(req.session.user.id, req.params.id);
    if (!result.success) {
      return res.redirect('/events?error=' + encodeURIComponent(result.error));
    }
    res.redirect('/events?success=' + encodeURIComponent('Successfully signed up for event'));
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/events/:id/cancel', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  try {
    const result = await eventService.cancelRegistration(req.session.user.id, req.params.id);
    if (!result.success) {
      return res.redirect('/events?error=' + encodeURIComponent(result.error));
    }
    res.redirect('/events?success=' + encodeURIComponent('Registration cancelled successfully'));
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/events/:id/delete', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  try {
    const result = await eventService.removeEvent(req.session.user.id, req.params.id);
    if (!result.success) {
      return res.status(result.status || 500).send(result.error); // AC-5: "Forbidden" error
    }
    res.redirect('/events?success=' + encodeURIComponent('Event deleted successfully'));
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

module.exports = router;
