var _ = require('lodash');

module.exports = function(stack){
	var context = this;
	var args = _.initial(_.rest(arguments)) || [];
	var callback = _.last(arguments) || _.noop();

	function next(fns, err){
		if(err || fns.length === 0){
			return callback(err);
		}
		else{
			_.take(fns).fn.apply(context, args.concat([_.partial(next, _.rest(fns))] ));
		}
	}

	next(stack);
};