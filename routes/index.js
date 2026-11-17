
var express = require('express');
var router = express.Router();
const { db } = require('../config/firebase');
/* GET home page */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

/* GET login */
router.get('/login', function(req, res, next) {
    res.render('login', { title: 'Iniciar sesión' });
});

/* GET registro */

router.get('/registro', async function(req, res, next) {
    try {
        const gruposSnapshot = await db.collection('grupos').get();

        const grupos = gruposSnapshot.docs.map(doc => ({
            id: doc.id,
            nombre: doc.data().nombre || 'Grupo sin nombre'
        }));

        console.log('Grupos obtenidos de Firebase:', grupos);

        res.render('registro', {
            title: 'Crear cuenta',
            grupos: grupos || []
        });

    } catch (error) {
        console.error('Error obteniendo grupos:', error);
        next(error);
    }
});


/* POST registro */
router.post('/registro', async function(req, res, next) {
    try {
        const { nombre, apellidos, email, fotoURL, grupoId } = req.body;

        await db.collection('usuarios').add({
            nombre: nombre,
            apellidos: apellidos,
            email: email,
            fotoURL: fotoURL || '',
            grupoId: grupoId,
            rol: 'admin'
        });

        res.send('Usuario registrado correctamente');

    } catch (error) {
        console.error('Error registrando usuario:', error);
        next(error);
    }
});


module.exports = router;
