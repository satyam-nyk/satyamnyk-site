const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyCjeFPztbGt0sl6JLE8kMud0bRYym6LoAY');
const d = await r.json();
if (d.error) { console.error('Error:', d.error.message); process.exit(1); }
d.models?.forEach(m => console.log(m.name, '-', m.supportedGenerationMethods?.join(',')));
